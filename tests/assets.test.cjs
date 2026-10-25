const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {JSDOM} = require('jsdom');
const C = require('./helpers/ctm-libs.cjs');
const source = fs.readFileSync(path.join(C.library, 'assets.js'), 'utf8');
function resolver(baseURI, mode, bases) {
  const context = vm.createContext({URL, document: {baseURI}, CTM_ASSETS: {v: 1, mode, bases}});
  vm.runInContext(source, context);
  return context.CTMAssets;
}
test('asset URLs are absolute at root and nested pages, with CDN bases unchanged', () => {
  const cdn = resolver('https://course.test/sub/page.html', 'cdn', {katex: 'https://cdn.test/katex@1/'});
  assert.equal(cdn.url('katex', 'dist/katex.mjs'), 'https://cdn.test/katex@1/dist/katex.mjs');
  for (const [page, base] of [['https://course.test/page.html', './_ctm-assets/'], ['https://course.test/sub/page.html', '../_ctm-assets/']]) {
    const local = resolver(page, 'local', {pyodide: base + 'pyodide/1/'});
    assert.equal(local.url('pyodide'), 'https://course.test/_ctm-assets/pyodide/1/');
    assert.equal(local.url('pyodide', 'pyodide.js'), 'https://course.test/_ctm-assets/pyodide/1/pyodide.js');
    for (const bad of ['../escape', 'a/\t../\t../escape', 'file\nname', 'file\rname', 'file\x00name', '%2e%2e/escape', '%2e%2e%2fother/file', 'dir%2f..%2fother', 'dir%5C..%5cother', '%2E%2e%2Fother', '//other.test/', 'https://other.test/', '/root', 'a\\b', 'file?x', 'file#x']) {
      assert.throws(() => local.url('pyodide', bad), /inside the selected asset/);
    }
    assert.throws(() => local.url('missing'), /unknown asset/);
  }
});
test('the shared runtime consumes the page-selected Pyodide base and preserves its canonical version line', async () => {
  const script = fs.readFileSync(path.join(C.library, 'runtime', 'pyodide-runtime.js'), 'utf8');
  assert.match(script, /\n\s*var indexURL = 'https:\/\/[^']+';/);
  const calls = [];
  const py = {};
  const context = vm.createContext({CTMAssets: {url: name => {assert.equal(name, 'pyodide'); return 'https://course.test/_ctm-assets/pyodide/test/';}},
    importScripts: url => calls.push(url), loadPyodide: async options => {calls.push(options.indexURL); return py;}});
  vm.runInContext(script, context);
  assert.equal(context.MathExerciseRuntime.indexURL, 'https://course.test/_ctm-assets/pyodide/test/');
  assert.equal(await context.MathExerciseRuntime.ensurePyodide(), py);
  assert.deepEqual(calls, ['https://course.test/_ctm-assets/pyodide/test/']);
});
const table = JSON.parse(fs.readFileSync(path.join(C.library, 'assets.json'), 'utf8'));
const runtime = fs.readFileSync(path.join(C.library, 'runtime', 'pyodide-runtime.js'), 'utf8');
const pyVersion = runtime.match(/var indexURL = '[^']+\/v([^/]+)\/full\/';/)[1];
function render(dir) { return C.render(dir, [], {CTM_COMPONENT_DEV: '1'}); }
function project({local = true, resources = true, theme = true, extra = '', front = '', nested = false, manifest = true} = {}) {
  const dir = C.tempdir('ctm-assets-');
  C.install(dir); C.installProbe(dir);
  const file = nested ? 'sub/page.qmd' : 'page.qmd';
  const versions = Object.fromEntries(Object.entries(table.assets).map(([k,v]) => [k,v.version]));
  versions.pyodide = pyVersion;
  C.write(dir, {
    '_quarto.yml': 'project:\n  type: default\n  render: [' + file + ']\n' + (resources ? '  resources: ["_ctm-assets/**"]\n' : '') +
      'filters: [ctm-libs, probe]\n' + (theme ? 'format:\n  html:\n    theme: [default, offline.scss]\n' : 'format: html\n') +
      'ctm-assessment:\n  assets: ' + (local ? 'local' : 'cdn') + '\nai-feedback:\n  enabled: false\n' + extra,
    'offline.scss': '/*-- scss:defaults --*/\n$web-font-path: false;\n',
    [file]: '---\ntitle: Asset probe\n' + front + '---\n\n$x^2$\n' + C.probe('asset', 'return {mode=ctm.assets.mode(), url=ctm.assets.url("pyodide"), katex=ctm.assets.url("katex", "dist/katex.mjs")}'),
    ['_ctm-assets/pyodide/' + pyVersion + '/pyodide-lock.json']: JSON.stringify({packages: {numpy: {}}})
  });
  if (manifest) C.write(dir, {'_ctm-assets/manifest.json': JSON.stringify({v:1,versions,files:{}})});
  return {dir,file,versions};
}
test('local assets select nested Lua paths, inline JS config and Quarto MathJax without a polyfill', {skip: !C.hasQuarto}, () => {
  const p = project({nested: true});
  try {
    fs.renameSync(path.join(p.dir,'offline.scss'),path.join(p.dir,'offline-system.scss'));
    const configFile=path.join(p.dir,'_quarto.yml');
    fs.writeFileSync(configFile,fs.readFileSync(configFile,'utf8').replace('offline.scss','offline-system.scss'));
    fs.appendFileSync(path.join(p.dir,p.file),C.probe('guard', 'return not pcall(ctm.assets.url, "katex", "a/" .. string.char(9) .. "../" .. string.char(9) .. "../escape")'));
    const result = render(p.dir);
    assert.equal(result.status, 0, result.stderr);
    const html = C.html(p.dir, p.file), got = C.probes(html).asset;
    assert.equal(got.mode, 'local');
    assert.equal(C.probes(html).guard, true);
    assert.equal(got.url, '../_ctm-assets/pyodide/' + pyVersion + '/');
    assert.equal(got.katex, '../_ctm-assets/' + table.assets.katex.local.replace('{version}', table.assets.katex.version) + 'dist/katex.mjs');
    assert.match(html, /globalThis\.CTM_ASSETS=/);
    const mathScript=JSDOM.fragment(html).querySelector('script#MathJax-script');
    assert.ok(mathScript, 'local MathJax script is present');
    assert.equal(mathScript.hasAttribute('async'),true);
    assert.equal(mathScript.getAttribute('type'),'text/javascript');
    assert.equal(mathScript.getAttribute('src'),'../_ctm-assets/npm/mathjax@'+table.assets.mathjax3.version+'/es5/tex-chtml-full.js');
    assert.doesNotMatch(html, /polyfill\.io|https:\/\/cdn\.jsdelivr\.net\/npm\/mathjax/);
  } finally {fs.rmSync(p.dir, {recursive:true,force:true});}
});
test('CDN mode preserves normal MathJax and accepts existing URL overrides without a bundle', {skip: !C.hasQuarto}, () => {
  const p = project({local:false,manifest:false,resources:false,theme:false,extra:'pyodide:\n  base-url: https://custom.test/python/\njsxgraph:\n  src_jxg: https://custom.test/board.js\n'});
  try {
    const result = render(p.dir); assert.equal(result.status,0,result.stderr);
    assert.equal(C.probes(C.html(p.dir,p.file)).asset.mode,'cdn');
    assert.match(C.html(p.dir,p.file), /https:\/\/cdn\.jsdelivr\.net\/npm\/mathjax/);
  } finally {fs.rmSync(p.dir,{recursive:true,force:true});}
});
test('local preflight rejects missing bundle, wrong versions, missing resources/theme, overrides and packages outside subset', {skip: !C.hasQuarto}, () => {
  const cases = [
    [{manifest:false}, /manifest is missing or invalid/],
    [{resources:false}, /project\.resources/],
    [{theme:false}, /offline\.scss or offline-system\.scss theme/],
    [{extra:'pyodide:\n  base-url: https://custom.test/\n'}, /pyodide\.base-url/],
    [{front:'pyodide:\n  build-variant: debug\n'}, /pyodide\.build-variant/],
    [{extra:'jsxgraph:\n  src_jxg: https://custom.test/board.js\n'}, /author HTTP jsxgraph\.src_jxg/],
    [{extra:'jsxgraph:\n  mjx_fonts: https://custom.test/fonts/\n'}, /author HTTP jsxgraph\.mjx_fonts/],
    [{extra:'pyodide:\n  packages: [not-in-bundle]\n'}, /outside the local subset/]
  ];
  for (const [options, message] of cases) {
    const p=project(options);
    try {const r=render(p.dir);assert.notEqual(r.status,0);assert.match(r.stderr,message);}
    finally {fs.rmSync(p.dir,{recursive:true,force:true});}
  }
  const p=project();
  try {
    p.versions.katex='wrong';
    C.write(p.dir,{'_ctm-assets/manifest.json':JSON.stringify({v:1,versions:p.versions,files:{}})});
    const r=render(p.dir);assert.notEqual(r.status,0);assert.match(r.stderr,/version mismatch for katex/);
  } finally {fs.rmSync(p.dir,{recursive:true,force:true});}
});

test('local worker receives an absolute page URL and loads only subset packages without micropip', async () => {
  const W = require('./helpers/worker.cjs');
  const page = W.pageContext();
  page.CTM_ASSETS = {v:1,mode:'local'};
  page.CTMAssets = {url: name => {assert.equal(name,'pyodide');return 'https://course.test/_ctm-assets/pyodide/test/';}};
  const started=page.CTMWorker.start({indexURL:'https://ignored.test/'});
  const worker=page.workers[0], cfg=worker.posted[0].config;
  assert.equal(cfg.indexURL,'https://course.test/_ctm-assets/pyodide/test/');
  assert.equal(cfg.assetsMode,'local');
  worker.reply({type:'result',id:worker.posted[0].id,value:true});
  await started;
  const network=W.fakeNet({packages:{numpy:{imports:['numpy']}}});
  const calls=[];
  const local=W.workerContext({globals:{fetch:network.fetch},pyodide:(_context,fake)=>({
    loadPackage:async names=>{
      calls.push(Array.from(names));
      for (const name of names) fake.loadedPackages[name] = 'default channel';
    },
    pyimport:()=>{throw new Error('local mode must not call micropip');}
  })});
  await local.init({assetsMode:'local',packages:['numpy']});
  assert.equal(local.result(0).type,'result');
  assert.deepEqual(calls,[['numpy']]);
  assert.ok(network.log.every(entry=>entry.file==='pyodide-lock.json'));
  const missing=W.workerContext({globals:{fetch:network.fetch},pyodide:()=>({
    loadPackage:async()=>{throw new Error('unknown package must be rejected before loading');}
  })});
  await missing.init({assetsMode:'local',packages:['not-installed']});
  assert.equal(missing.result(0).type,'error');
  assert.match(missing.result(0).message,/outside the local Pyodide subset/);
});

test('assessment pins supply URLs and required versions even when the author keeps local board paths', {skip: !C.hasQuarto}, () => {
  const p=project({extra:'jsxgraph:\n  src_jxg: boards/custom.js\n  src_css: boards/custom.css\n  src_mjx: boards/custom-math.js\n'});
  try {
    const packageDir=C.installPackage(p.dir);
    fs.writeFileSync(path.join(packageDir,'jsxgraph-pins.yml'),'jsxgraph:\n  src_jxg: https://cdn.jsdelivr.net/npm/jsxgraph@1.2.3/distrib/jsxgraphcore.js\n  src_css: https://cdn.jsdelivr.net/npm/jsxgraph@1.2.3/distrib/jsxgraph.css\n  src_mjx: https://cdn.jsdelivr.net/npm/mathjax@4.5.6/tex-mml-svg.js\n  mjx_fonts: https://cdn.jsdelivr.net/npm/@mathjax/mathjax-newcm-font@7.8.9/\n');
    Object.assign(p.versions,{jsxgraph:'1.2.3',mathjax4:'4.5.6','mathjax-newcm-font':'7.8.9'});
    C.write(p.dir,{'_ctm-assets/manifest.json':JSON.stringify({v:1,versions:p.versions,files:{}})});
    fs.appendFileSync(path.join(p.dir,p.file),C.probe('board','return {url=ctm.assets.url("jsxgraph", "distrib/jsxgraphcore.js"), fonts=ctm.assets.url("mathjax-newcm-font"), own=pandoc.utils.stringify(ctm.settings.meta().jsxgraph.src_jxg)}'));
    let r=render(p.dir);assert.equal(r.status,0,r.stderr);
    const got=C.probes(C.html(p.dir,p.file)).board;
    assert.equal(got.url,'./_ctm-assets/npm/jsxgraph@1.2.3/distrib/jsxgraphcore.js');
    assert.equal(got.fonts,'./_ctm-assets/npm/@mathjax/mathjax-newcm-font@7.8.9/');
    assert.equal(got.own,'boards/custom.js');
    delete p.versions.jsxgraph;
    C.write(p.dir,{'_ctm-assets/manifest.json':JSON.stringify({v:1,versions:p.versions,files:{}})});
    r=render(p.dir);assert.notEqual(r.status,0);assert.match(r.stderr,/version mismatch for jsxgraph/);
  } finally {fs.rmSync(p.dir,{recursive:true,force:true});}
});

test('local preflight catches format-scoped project overrides hidden by nearer section maps', {skip: !C.hasQuarto}, () => {
  const p=project({front:'pyodide:\n  packages: [numpy]\njsxgraph:\n  src_css: boards/custom.css\n'});
  try {
    const file=path.join(p.dir,'_quarto.yml');
    fs.writeFileSync(file,fs.readFileSync(file,'utf8').replace('ctm-assessment:\n',
      '    pyodide:\n      base-url: https://custom.test/python/\n    jsxgraph:\n      src_jxg: https://custom.test/board.js\n      mjx_fonts: https://custom.test/fonts/\nctm-assessment:\n'));
    const r=render(p.dir);assert.notEqual(r.status,0);
    assert.match(r.stderr,/pyodide\.base-url.*format\.html/);
    assert.match(r.stderr,/author HTTP jsxgraph\.src_jxg.*format\.html/);
    assert.match(r.stderr,/author HTTP jsxgraph\.mjx_fonts.*format\.html/);
  } finally {fs.rmSync(p.dir,{recursive:true,force:true});}
});

test('local asset preflight and API 3 saved-answer registration retain all store settings', {skip: !C.hasQuarto}, () => {
  const p=project({nested:true,front:'ctm-assessment:\n  save: answers\n  progress: true\n  storage-key: union-course\n  export: true\n'});
  try {
    const config=path.join(p.dir,'_quarto.yml');
    fs.writeFileSync(config,fs.readFileSync(config,'utf8').replace(
      'filters: [ctm-libs, probe]','filters: [ctm-libs, probe, _extensions/ctm-libs/ctm-libs-end.lua]'));
    fs.appendFileSync(path.join(p.dir,p.file),'\n~~~{.python #union-cell}\npass\n~~~\n'+C.probe('registered',[
      'assert(ctm.api == 3)',
      'local out',
      'doc.blocks:walk({CodeBlock=function(b)',
      ' if b.identifier == "union-cell" then out=ctm.ui.exercise{component="py-exercise",id="union-cell",',
      '  source=pandoc.utils.sha1(b.text):sub(1,16),block=b} end',
      'end})',
      'return {mode=ctm.assets.mode(),registration=out,defaultURL=ctm.runtime.defaultIndexURL(),selectedURL=ctm.runtime.indexURL()}'
    ].join('\n')));
    const result=render(p.dir);assert.equal(result.status,0,result.stderr);
    const html=C.html(p.dir,p.file), got=C.probes(html).registered;
    assert.equal(got.mode,'local');
    assert.equal(got.registration.save,true);
    assert.equal(got.registration.attributes['data-ctm-component'],'py-exercise');
    assert.match(got.defaultURL,/^https:\/\/cdn\.jsdelivr\.net\/pyodide\/v[^/]+\/full\/$/);
    assert.equal(got.selectedURL,'../_ctm-assets/pyodide/'+pyVersion+'/');
    const manifest=JSON.parse(html.match(/id="ctm-store-manifest">([\s\S]*?)<\/script>/)[1]);
    assert.equal(manifest.course,'union-course');
    assert.equal(manifest.save,true);
    assert.equal(manifest.progress,true);
    assert.equal(manifest.export,true);
    assert.equal(manifest.exercises.length,1);
    assert.equal(manifest.exercises[0].id,'union-cell');
    assert.equal(manifest.exercises[0].runtimeId,got.registration.attributes['data-ctm-runtime-id']);
    assert.doesNotMatch(html,/data-__ctm-/);
  } finally {fs.rmSync(p.dir,{recursive:true,force:true});}
});


test('immutable Git board pins select the same CDN and local asset family', {skip: !C.hasQuarto}, () => {
  const sha='a'.repeat(40),cdn='https://cdn.jsdelivr.net/gh/owner/runtime@'+sha+'/';
  for(const local of [false,true]){
    const p=project({local});
    try{
      const packageDir=C.installPackage(p.dir);
      fs.writeFileSync(path.join(packageDir,'jsxgraph-pins.yml'),'jsxgraph:\n  src_jxg: '+cdn+'core.js\n  src_css: '+cdn+'core.css\n');
      p.versions.jsxgraph=sha;
      C.write(p.dir,{'_ctm-assets/manifest.json':JSON.stringify({v:1,versions:p.versions,files:{}})});
      fs.appendFileSync(path.join(p.dir,p.file),C.probe('git','return {url=ctm.assets.url("jsxgraph", "core.js")}'));
      const r=render(p.dir);assert.equal(r.status,0,r.stderr);
      assert.equal(C.probes(C.html(p.dir,p.file)).git.url,local?'./_ctm-assets/gh/owner/runtime@'+sha+'/core.js':cdn+'core.js');
    }finally{fs.rmSync(p.dir,{recursive:true,force:true});}
  }
});
