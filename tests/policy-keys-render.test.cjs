// Decision-sheet rows A1-A4 and A7 for the settings of ctm-libs:
// credentials stop the render in every CTM section (A1); policy-files adds up
// and policy selects, with the old keys as deprecated aliases (A2); unknown
// options warn, naming 1.0 (A3, A7: version is unknown); the storage default
// stays local (A4).
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const C = require('./helpers/ctm-libs.cjs');
const F = require('../_extensions/ctm-libs/feedback/feedback-core.js');
const skip = C.hasQuarto ? false : 'Quarto required';
const INTEGRATIONS = ['plain-text', 'py-exercise', 'math-exercise', 'pyodide-interaktiv', 'stack'];

function withProject(files, run) {
  const dir = C.tempdir('ctm-policy-keys-');
  try {
    C.install(dir);
    C.write(dir, {
      'a.yml': 'ai-feedback:\n  policies:\n    alpha:\n      max-words: 100\n      base-prompt: Alpha prompt.\n',
      'b.yml': 'ai-feedback:\n  policies:\n    beta:\n      extends: alpha\n      max-words: 60\n',
      'c.yml': 'ai-feedback:\n  policies:\n    gamma:\n      max-words: 40\n',
      ...files,
    });
    return run(dir);
  } finally { fs.rmSync(dir, {recursive: true, force: true}); }
}
const project = (pages, extra) => 'project:\n  type: default\n  render: [' + pages.join(', ') + ']\nfilters: [ctm-libs]\n' + extra;
const page = front => '---\ntitle: t\n' + front + '---\n\n::: {.ai-feedback}\nExplain.\n:::\n';
const policies = (dir, file) => JSON.parse(C.html(dir, file).match(/window\.__aiFeedbackPolicies = (.*?);<\/script>/s)[1]);
const names = config => config.layers.map(layer => Object.keys(layer.policies));

test('A1: a credential-like key stops the render in every CTM section and at every level', {skip}, () => withProject({
  '_quarto.yml': project(['sub/page.qmd'], 'py-exercise:\n  token: tok-1111\n  submission-key: not-a-credential\n'),
  '_quarto-p.yml': 'ai-feedback:\n  secret: sec-2222\n',
  'sub/_metadata.yml': 'math-exercise:\n  api_key: key-3333\n',
  'sub/page.qmd': page('ctm-assessment:\n  password: pw-4444\n'),
}, dir => {
  const r = C.render(dir, ['--profile', 'p']);
  assert.notEqual(r.status, 0);
  const lines = r.stderr.split('\n').filter(line => /looks like a credential/.test(line)).join('\n');
  for (const [section, key, origin] of [['py-exercise', 'token', '_quarto.yml'], ['ai-feedback', 'secret', '_quarto-p.yml'],
    ['math-exercise', 'api_key', 'sub/_metadata.yml'], ['ctm-assessment', 'password', 'sub/page.qmd']]) {
    assert.match(lines, new RegExp(section + ': ' + key + ' in ' + origin.replace(/\./g, '\\.') + ' looks like a credential\\. Remove it'));
  }
  assert.doesNotMatch(lines, /submission-key|1111|2222|3333|4444/);
}));

test('A2: policy-files adds up over project, _metadata and page; the nearest policy wins', {skip}, () => withProject({
  '_quarto.yml': project(['sub/page.qmd', 'top.qmd', 'both.qmd'], 'ai-feedback:\n  policy-files: a.yml\n  policy: alpha\n'),
  'sub/_metadata.yml': 'ai-feedback:\n  policy-files: [b.yml, a.yml]\n',
  'sub/page.qmd': page('ai-feedback:\n  policy-files: c.yml\n  policy: beta\n'),
  'top.qmd': page(''),
  'both.qmd': page('ai-feedback:\n  policy: gamma\n  project-policy: beta\n  policy-files: [c.yml, b.yml]\n'),
}, dir => {
  const r = C.render(dir);
  assert.equal(r.status, 0, r.stderr);
  let config = policies(dir, 'sub/page.qmd');
  assert.deepEqual(names(config), [['alpha'], ['beta'], ['gamma']]);
  assert.equal(config.projectPolicy, 'beta');
  assert.equal(config.pagePolicy, undefined);
  assert.equal(F.resolvePolicy('math-exercise', 'en', {}, config)['max-words'], 60);
  config = policies(dir, 'top.qmd');
  assert.deepEqual(names(config), [['alpha']]);
  assert.equal(config.projectPolicy, 'alpha');
  config = policies(dir, 'both.qmd');
  assert.deepEqual(names(config), [['alpha'], ['gamma'], ['beta']]);
  assert.equal(config.projectPolicy, 'gamma', 'at one level, policy wins over project-policy');
  assert.match(r.stderr, /ai-feedback: project-policy \(in both\.qmd\) is deprecated; use policy \(the nearest setting wins\)\. It keeps working in 0\.9\./);
}));

test('A2: the deprecated keys keep their meaning, warn once per setting, and give the same effective policy as the new keys', {skip}, () => withProject({
  '_quarto.yml': project(['old.qmd'], 'ai-feedback:\n  policy-files: a.yml\n  project-policy: alpha\n'),
  'old.qmd': page('ai-feedback:\n  page-policy-files: b.yml\n  page-policy: beta\n'),
  'new/_quarto.yml': project(['new.qmd'], 'ai-feedback:\n  policy-files: ../a.yml\n  policy: alpha\n'),
  'new/new.qmd': page('ai-feedback:\n  policy-files: ../b.yml\n  policy: beta\n'),
}, dir => {
  let r = C.render(dir);
  assert.equal(r.status, 0, r.stderr);
  for (const [key, origin, advice] of [['project-policy', '_quarto.yml', 'use policy \\(the nearest setting wins\\)'],
    ['page-policy-files', 'old.qmd', 'use policy-files, which now adds up across project, _metadata and page'],
    ['page-policy', 'old.qmd', "use policy, extending the project's policy where needed"]]) {
    const pattern = new RegExp('ai-feedback: ' + key + ' \\(in ' + origin.replace('.', '\\.') + '\\) is deprecated; ' + advice + '\\. It keeps working in 0\\.9\\.', 'g');
    assert.equal(r.stderr.match(pattern)?.length, 1, key);
  }
  const old = policies(dir, 'old.qmd');
  assert.deepEqual([old.projectPolicy, old.pagePolicy, old.pageLayers.length], ['alpha', 'beta', 1]);
  fs.cpSync(path.join(dir, '_extensions'), path.join(dir, 'new', '_extensions'), {recursive: true});
  r = C.render(path.join(dir, 'new'));
  assert.equal(r.status, 0, r.stderr);
  assert.doesNotMatch(r.stderr, /deprecated/);
  const current = policies(path.join(dir, 'new'), 'new.qmd');
  for (const integration of INTEGRATIONS) {
    for (const selection of [{}, {name: 'alpha'}, {exercise: 'x', name: 'beta'}]) {
      assert.deepEqual(F.resolvePolicy(integration, 'en', {}, current, selection), F.resolvePolicy(integration, 'en', {}, old, selection), integration);
    }
  }
}));

test('A3/A7: unknown options, version among them, warn and name CTM Assessment 1.0', {skip}, () => withProject({
  '_quarto.yml': project(['page.qmd'], 'ai-feedback:\n  version: 1\nctm-assessment:\n  python-preload: idle\n'),
  'page.qmd': page('ai-feedback:\n  modle: typo\n'),
}, dir => {
  const r = C.render(dir);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stderr, /ai-feedback: unknown option version \(_quarto\.yml\) is ignored; this becomes an error in CTM Assessment 1\.0\. Known options: mode, storage, base-url, model, generator-model, ui-language, feedback-language, enabled, similar, without-ai, policy-files, policy, generation-policy\./);
  assert.match(r.stderr, /ai-feedback: unknown option modle \(page\.qmd\) is ignored; this becomes an error in CTM Assessment 1\.0\./);
  assert.match(r.stderr, /ctm-assessment: unknown option python-preload \(_quarto\.yml\) is ignored; this becomes an error in CTM Assessment 1\.0\. Known options: stop-after, lang, save, tab-links, modes, markdown-lint, progress, storage-key, export, assets, variants\./);
}));

test('A4: settings are remembered on this device by default', () => {
  const {JSDOM} = require('jsdom');
  const w = new JSDOM('<main></main>', {url: 'https://example.invalid/course', runScripts: 'outside-only'}).window;
  for (const file of ['feedback-core.js', 'feedback-dom.js', 'ai-feedback.js']) w.eval(fs.readFileSync(path.join(C.feedback, file), 'utf8'));
  assert.equal(w.AIFeedback.loadConfig().storage, 'local');
  const dialog = w.AIFeedback.buildSettings();
  const storage = [...dialog.querySelectorAll('select')].find(select => [...select.options].some(option => option.value === 'session'));
  assert.equal(storage.value, 'local');
  assert.equal(storage.selectedOptions[0].textContent, 'Remember on this device');
  w.close();
});
