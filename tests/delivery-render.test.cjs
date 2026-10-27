// D1: ctm-libs delivers its browser files as HTML dependencies (cacheable
// files, each once per page whatever the mix of components), and the same
// pages work with embed-resources.
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const {JSDOM} = require('jsdom');
const C = require('./helpers/ctm-libs.cjs');
const skip = C.hasQuarto ? false : 'Quarto required';

// Two components on one page, both asking for the runtime and the locale.
const uses = C.probe('first', 'ctm.runtime.use(); ctm.locale.use("math-exercise"); return true')
  + C.probe('second', 'ctm.runtime.use(); ctm.locale.use("py-exercise"); ctm.locale.use("math-exercise"); return true');
const activity = '\n::: {.ai-feedback #act}\nWrite.\n:::\n';

function withProject(front, run) {
  const dir = C.tempdir('ctm-delivery-');
  try {
    C.installPackage(dir); C.install(dir); C.installProbe(dir);
    C.write(dir, {'page.qmd': '---\ntitle: t\nlang: nb\nfilters: [ctm-libs, probe]\n' + front + '---\n' + activity + uses});
    return run(dir);
  } finally { fs.rmSync(dir, {recursive: true, force: true}); }
}

test('each ctm-libs file is one script or stylesheet of the head, loaded once', {skip}, () => withProject('', dir => {
  const r = C.render(dir, ['page.qmd']);
  assert.equal(r.status, 0, r.stderr);
  const html = C.html(dir, 'page.qmd');
  const head = html.slice(0, html.indexOf('</head>'));
  const v = C.version();
  const ours = [...head.matchAll(/<(?:script src|link href)="([^"]*quarto-contrib\/[^"]*)"/g)].map(m => m[1].replace(/^.*quarto-contrib\//, ''));
  // In registration order; Quarto keeps one dependency per name.
  assert.deepEqual(ours, [
    `ctm-assets-${v}/assets.js`,
    `ctm-locale-${v}/ctm-locale.js`, `ctm-locale-${v}/common.js`, `ctm-locale-ui-${v}/ui.js`,
    `ctm-layout-${v}/ctm-layout.js`, `ctm-layout-${v}/ctm-settings.js`, `ctm-layout-${v}/ctm-ui.css`,
    `ai-feedback-${v}/feedback-core.js`, `ai-feedback-${v}/feedback-dom.js`, `ai-feedback-${v}/ai-feedback.js`, `ai-feedback-${v}/ai-feedback.css`,
    `ctm-runtime-${v}/pyodide-runtime.js`, `ctm-worker-${v}/pyodide-worker.js`,
    `ctm-locale-math-exercise-${v}/math-exercise.js`, `ctm-locale-py-exercise-${v}/py-exercise.js`,
  ]);
  for (const [, src] of head.matchAll(/<(?:script src|link href)="([^"]*quarto-contrib\/[^"]*)"/g)) assert.ok(fs.existsSync(path.join(dir, src)), src);
  // Nothing of ctm-libs is inlined.
  assert.doesNotMatch(html, /MathExerciseRuntime =|CTMLocales\.add\(|root\.AIFeedback = /);
}));

test('with embed-resources the page is self-contained and its scripts run', {skip}, () => withProject('format:\n  html:\n    embed-resources: true\n', dir => {
  const r = C.render(dir, ['page.qmd']);
  assert.equal(r.status, 0, r.stderr);
  const html = C.html(dir, 'page.qmd');
  assert.doesNotMatch(html, /quarto-contrib\//);
  const w = new JSDOM(html, {url: 'https://example.invalid/page.html', runScripts: 'dangerously', resources: 'usable'}).window;
  return new Promise(resolve => w.addEventListener('load', resolve)).then(() => {
    assert.equal(typeof w.MathExerciseRuntime.ensurePyodide, 'function');
    assert.equal(w.CTMLocales.table('py-exercise', 'nb').stop, 'Avbryt');
    assert.equal(w.CTMLocales.table('math-exercise', 'nb').resPartial(50), 'Delvis riktig (50%).');
    assert.equal(w.AIFeedback.version, C.version());
    assert.equal(w.document.querySelector('#act button.ai-feedback-button').textContent, 'Tilbakemelding');
    w.close();
  });
}));
