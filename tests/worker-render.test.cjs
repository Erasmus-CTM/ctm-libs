// ctm.runtime.worker() and ctm.runtime.indexURL() at render time: the
// worker's dependencies (ctm-runtime, then ctm-worker), coi-serviceworker.js
// written once at the output root and loaded relative to the project root
// from every page, and the one Pyodide constant shared by Lua and the browser.
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const C = require('./helpers/ctm-libs.cjs');
const skip = C.hasQuarto ? false : 'Quarto required';
const DEV = {CTM_COMPONENT_DEV: '1'};
const WORKER = C.probe('index', 'ctm.runtime.worker(); ctm.runtime.worker(); return ctm.runtime.indexURL()');

test('indexURL() is the constant of runtime/pyodide-runtime.js', () => {
  const js = fs.readFileSync(path.join(C.library, 'runtime', 'pyodide-runtime.js'), 'utf8');
  assert.match(js, /\n  var indexURL = 'https:\/\/cdn\.jsdelivr\.net\/pyodide\/v\d+\.\d+\.\d+\/full\/';\n/);
});

test('worker(): dependencies once per page, coi-serviceworker.js at the output root, its tag relative to the root', {skip}, () => {
  const dir = C.tempdir('ctm-worker-');
  try {
    C.install(dir); C.installProbe(dir);
    C.write(dir, {
      '_quarto.yml': 'project:\n  type: website\n  output-dir: _site\n  render: [index.qmd, sub/page.qmd]\nfilters: [probe]\n',
      'index.qmd': '---\ntitle: t\n---\n' + WORKER,
      'sub/page.qmd': '---\ntitle: t\n---\n' + WORKER,
    });
    const r = C.render(dir, [], DEV);
    assert.equal(r.status, 0, r.stderr);
    const js = fs.readFileSync(path.join(C.library, 'runtime', 'pyodide-runtime.js'), 'utf8');
    const constant = js.match(/var indexURL = '([^']+)';/)[1];
    const site = path.join(dir, '_site');
    assert.deepEqual(fs.readFileSync(path.join(site, 'coi-serviceworker.js')), fs.readFileSync(path.join(C.library, 'runtime', 'coi-serviceworker.js')));
    assert.ok(!fs.existsSync(path.join(site, 'sub', 'coi-serviceworker.js')));
    for (const [page, offset] of [['index.html', '.'], ['sub/page.html', '..']]) {
      const html = fs.readFileSync(path.join(site, page), 'utf8');
      assert.equal(C.probes(html).index, constant, page);
      const tags = [...html.matchAll(/<script src="([^"]*coi-serviceworker\.js)"><\/script>/g)].map(m => m[1]);
      assert.deepEqual(tags, [offset + '/coi-serviceworker.js'], page);
      const scripts = [...html.matchAll(/<script src="[^"]*quarto-contrib\/(ctm-runtime|ctm-worker)-[^/]+\/([^"]+)"/g)].map(m => m[1] + '/' + m[2]);
      assert.deepEqual(scripts, ['ctm-runtime/pyodide-runtime.js', 'ctm-worker/pyodide-worker.js'], page);
      const wrapper = html.match(/<script src="([^"]*ctm-worker-[^/]+\/pyodide-worker\.js)"/)[1];
      const core = path.resolve(path.dirname(path.join(site, page)), path.dirname(wrapper), 'pyodide-worker-core.js');
      assert.deepEqual(fs.readFileSync(core), fs.readFileSync(path.join(C.library, 'runtime/pyodide-worker-core.js')), page + ' self-hosted worker entry');
      assert.ok(html.indexOf('ctm-worker/pyodide-worker.js') < html.indexOf('</head>') || html.search(/ctm-worker-[^/]+\/pyodide-worker\.js/) < html.indexOf('</head>'), page);
    }
  } finally { fs.rmSync(dir, {recursive: true, force: true}); }
});
