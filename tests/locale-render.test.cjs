// ctm.locale at render time: which language a component gets, the catalogue
// texts Lua renders, the catalogue dependencies, and the languages of
// AI feedback activities (§4 of the step-1 design).
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const C = require('./helpers/ctm-libs.cjs');
const skip = C.hasQuarto ? false : 'Quarto required';

function withProject(files, run) {
  const dir = C.tempdir('ctm-locale-');
  try {
    C.installPackage(dir); C.install(dir); C.installProbe(dir);
    C.write(dir, files);
    return run(dir);
  } finally { fs.rmSync(dir, {recursive: true, force: true}); }
}
const project = (pages, extra = '') => 'project:\n  type: default\n  render: [' + pages.join(', ') + ']\nfilters: [ctm-libs, probe]\n' + extra;
const page = (front, ...body) => '---\ntitle: t\n' + front + '---\n' + body.join('');
const resolve = (name, component) => C.probe(name, 'return {ctm.locale.resolve("' + component + '")}');
const data = html => [...html.matchAll(/<script type="application\/json" class="ai-feedback-data">([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]));

test('a component\'s language: its option, then ctm-assessment: lang, then lang, then en; through the chain', {skip}, () => withProject({
  '_quarto.yml': project(['own.qmd', 'shared.qmd', 'quarto.qmd', 'none.qmd']),
  'own.qmd': page('lang: de\nctm-assessment:\n  lang: en\nmath-exercise:\n  lang: nb-NO\npy-exercise:\n  lang: nn\n',
    resolve('math', 'math-exercise'), resolve('py', 'py-exercise'), resolve('feedback', 'ai-feedback')),
  'shared.qmd': page('lang: de\nctm-assessment:\n  lang: nn\nai-feedback:\n  ui-language: es\n',
    resolve('math', 'math-exercise'), resolve('feedback', 'ai-feedback')),
  'quarto.qmd': page('lang: sv\n', resolve('math', 'math-exercise'), resolve('py', 'py-exercise')),
  'none.qmd': page('', resolve('math', 'math-exercise'), C.probe('supported', 'return {ctm.locale.supported("feedback"), ctm.locale.supported("py-exercise")}')),
}, dir => {
  const r = C.render(dir);
  assert.equal(r.status, 0, r.stderr);
  let p = C.probes(C.html(dir, 'own.qmd'));
  assert.deepEqual(p.math, ['nb', 'nb-NO', 'own.qmd']);
  assert.deepEqual(p.py, ['nb', 'nn', 'own.qmd']);
  assert.deepEqual(p.feedback, ['en', 'en', 'own.qmd']);
  p = C.probes(C.html(dir, 'shared.qmd'));
  assert.deepEqual(p.math, ['nb', 'nn', 'shared.qmd']);
  assert.deepEqual(p.feedback, ['es', 'es', 'shared.qmd']);
  p = C.probes(C.html(dir, 'quarto.qmd'));
  assert.deepEqual(p.math, ['en', 'sv', 'lang']);
  p = C.probes(C.html(dir, 'none.qmd'));
  assert.deepEqual(p.math, ['en', 'en', 'lang']);  // Quarto sets lang: en by default
  assert.deepEqual(p.supported, [['en', 'de', 'nb', 'es'], ['en', 'de', 'nb']]);
}));

test('Lua renders the same catalogue texts as the browser', {skip}, () => withProject({
  '_quarto.yml': project(['page.qmd']),
  'page.qmd': page('', C.probe('texts', [
    'return {',
    '  ctm.locale.text("math-exercise", "checkButton", "nb"),',
    '  ctm.locale.text("math-exercise", "resPartial", "de", 50),',
    '  ctm.locale.text("math-exercise", "resNotForm", "nb", "single_fraction"),',
    '  ctm.locale.text("math-exercise", "resNotForm", "en", "cubic"),',
    '  ctm.locale.text("math-exercise", "errStopped", "de"),',
    '  ctm.locale.text("py-exercise", "allPassed", "en", 1),',
    '  ctm.locale.text("py-exercise", "someFailed", "nb", 2, 5),',
    '  ctm.locale.text("py-exercise", "noscript", "nb"),',
    '  ctm.locale.text("py-exercise", "msgTestError", "de"),',
    '  ctm.locale.text("math-exercise", "legend", "en")[1][3],',
    '}'].join('\n'))),
}, dir => {
  const r = C.render(dir);
  assert.equal(r.status, 0, r.stderr);
  const context = vm.createContext({console});
  for (const file of ['ctm-locale.js', 'common.js', 'math-exercise.js', 'py-exercise.js']) vm.runInContext(fs.readFileSync(path.join(C.library, 'locales', file), 'utf8'), context);
  const t = (...args) => context.CTMLocales.t(...args);
  assert.deepEqual(C.probes(C.html(dir, 'page.qmd')).texts, [
    t('math-exercise', 'checkButton', 'nb'), t('math-exercise', 'resPartial', 'de', 50), t('math-exercise', 'resNotForm', 'nb', 'single_fraction'),
    t('math-exercise', 'resNotForm', 'en', 'cubic'), t('math-exercise', 'errStopped', 'de'), t('py-exercise', 'allPassed', 'en', 1),
    t('py-exercise', 'someFailed', 'nb', 2, 5), t('py-exercise', 'noscript', 'nb'), t('py-exercise', 'msgTestError', 'de'), 'Power']);
}));

test('a missing text falls back to English with one build warning', {skip}, () => withProject({
  '_quarto.yml': project(['page.qmd']),
  'page.qmd': page('', C.probe('label', 'return {ctm.locale.text("py-exercise", "stdoutLabel", "nb"), ctm.locale.text("py-exercise", "stdoutLabel", "nb")}')),
}, dir => {
  const file = path.join(dir, '_extensions', 'ctm-libs', 'locales', 'py-exercise.js');
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('"stdoutLabel": "Utskrift:",\n', ''));
  const r = C.render(dir);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(C.probes(C.html(dir, 'page.qmd')).label, ['Output:', 'Output:']);
  assert.equal(r.stderr.match(/the py-exercise message stdoutLabel has no nb text; using English/g).length, 1);
}));

test('catalogue dependencies: the resolver and common messages once, then each namespace, in the head', {skip}, () => withProject({
  '_quarto.yml': project(['page.qmd']),
  'page.qmd': page('', C.probe('use', 'ctm.locale.use("math-exercise"); ctm.locale.use("py-exercise"); ctm.locale.use("math-exercise"); return true')),
}, dir => {
  const r = C.render(dir);
  assert.equal(r.status, 0, r.stderr);
  const html = C.html(dir, 'page.qmd');
  const head = html.slice(0, html.indexOf('</head>'));
  const v = C.version().replace(/\./g, '\\.');
  const scripts = [...head.matchAll(/<script src="([^"]*)"><\/script>/g)].map(m => m[1]).filter(src => /ctm-locale/.test(src));
  assert.deepEqual(scripts.map(src => src.replace(/^.*quarto-contrib\//, '')), [
    'ctm-locale-' + C.version() + '/ctm-locale.js', 'ctm-locale-' + C.version() + '/common.js',
    'ctm-locale-ui-' + C.version() + '/ui.js',
    'ctm-locale-math-exercise-' + C.version() + '/math-exercise.js', 'ctm-locale-py-exercise-' + C.version() + '/py-exercise.js']);
  for (const src of scripts) assert.ok(fs.existsSync(path.join(dir, src)), src);
  assert.doesNotMatch(html, new RegExp('ctm-locale-feedback-' + v));
}));

test('activities: the interface language goes through the chain, feedback keeps the page\'s tag', {skip}, () => withProject({
  '_quarto.yml': project(['nn.qmd', 'shared.qmd', 'attribute.qmd']),
  'nn.qmd': page('lang: nn\n', '\n::: {.ai-feedback}\nSkriv.\n:::\n'),
  'shared.qmd': page('lang: en\nctm-assessment:\n  lang: de-AT\n', '\n::: {.ai-feedback}\nSchreib.\n:::\n'),
  'attribute.qmd': page('lang: nb\nai-feedback:\n  feedback-language: en\n', '\n::: {.ai-feedback ui-language="de-CH"}\nSchreib.\n:::\n\n::: {.ai-feedback ui-language="xx" feedback-language="es"}\nEscribe.\n:::\n'),
}, dir => {
  const r = C.render(dir);
  assert.equal(r.status, 0, r.stderr);
  const pick = file => data(C.html(dir, file)).map(d => [d.uiLanguage, d.feedbackLanguage]);
  assert.deepEqual(pick('nn.qmd'), [['nb', 'nn']]);
  assert.deepEqual(pick('shared.qmd'), [['de', 'de-AT']]);
  assert.deepEqual(pick('attribute.qmd'), [['de', 'en'], ['en', 'es']]);
}));

test('pyodide-interaktiv: pyodide: lang, then ctm-assessment: lang, then lang; nn shows Bokmål; Lua texts equal the browser\'s', {skip}, () => withProject({
  '_quarto.yml': project(['own.qmd', 'shared.qmd', 'quarto.qmd']),
  'own.qmd': page('lang: de\nctm-assessment:\n  lang: en\npyodide:\n  lang: sv\n', resolve('pyodide', 'pyodide-interaktiv')),
  'shared.qmd': page('lang: de\nctm-assessment:\n  lang: nn\n', resolve('pyodide', 'pyodide-interaktiv'),
    C.probe('noscript', 'return {ctm.locale.text("pyodide-interaktiv", "noscript", "nb"), ctm.locale.text("pyodide-interaktiv", "engineFailed", "de", "x")}')),
  'quarto.qmd': page('lang: no\n', resolve('pyodide', 'pyodide-interaktiv')),
}, dir => {
  const r = C.render(dir);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(C.probes(C.html(dir, 'own.qmd')).pyodide, ['sv', 'sv', 'own.qmd']);
  const shared = C.probes(C.html(dir, 'shared.qmd'));
  assert.deepEqual(shared.pyodide, ['nb', 'nn', 'shared.qmd']);
  assert.deepEqual(shared.noscript, ['Slå på JavaScript for å kunne bruke de interaktive kodecellene på denne siden.', '🔴 Python konnte nicht geladen werden: x']);
  assert.deepEqual(C.probes(C.html(dir, 'quarto.qmd')).pyodide, ['nb', 'no', 'lang']);
}));
