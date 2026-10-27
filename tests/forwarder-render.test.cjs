// templates/ai-feedback: the forwarder pyodide-interaktiv ships next to its
// copy of ctm-libs (step-3 design §18.6, E9 (ii)). `quarto add
// Erasmus-CTM/pyodide-interaktiv` writes it over the ai-feedback 0.8.1 folder
// of older projects: `filters: [ai-feedback, ...]` keeps working with one
// deprecation warning, and older loaders get the page's feedback module.
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const C = require('./helpers/ctm-libs.cjs');
const skip = C.hasQuarto ? false : 'Quarto required';
const TEMPLATE = path.join(C.repository, 'templates', 'ai-feedback');
const activity = '\n::: {.ai-feedback #act}\nWrite one sentence.\n:::\n';

function withProject(setup, run) {
  const dir = C.tempdir('ctm-forwarder-');
  try { setup(dir); return run(dir); } finally { fs.rmSync(dir, {recursive: true, force: true}); }
}
// pyodide-interaktiv's layout after `quarto add`: ctm-libs and the forwarder under the owner folder.
function installStandalone(dir) {
  C.install(dir, {owner: 'Erasmus-CTM'});
  fs.cpSync(TEMPLATE, path.join(dir, '_extensions', 'Erasmus-CTM', 'ai-feedback'), {recursive: true});
}

test('the forwarder: three files, the version of ctm-libs, its own deprecation text', () => {
  assert.deepEqual(fs.readdirSync(TEMPLATE).sort(), ['_extension.yml', 'ai-feedback.lua', 'feedback-quarto.lua']);
  assert.equal(C.version(TEMPLATE), C.version());
  const lua = fs.readFileSync(path.join(TEMPLATE, 'ai-feedback.lua'), 'utf8');
  assert.doesNotMatch(lua, /keeps working in 0\.9/);   // N8
});

test('filters: [ai-feedback] through the forwarder renders with one deprecation warning', {skip}, () => withProject(dir => {
  installStandalone(dir);
  C.write(dir, {'page.qmd': '---\ntitle: t\nfilters: [ai-feedback]\n---\n' + activity});
}, dir => {
  const r = C.render(dir, ['page.qmd']);
  assert.equal(r.status, 0, r.stderr);
  const warning = /filters: \[ai-feedback\] is deprecated: AI feedback is part of pyodide-interaktiv and of CTM Assessment; list pyodide-interaktiv or ctm-assessment instead\./g;
  assert.equal(r.stderr.match(warning)?.length, 1, r.stderr);
  assert.match(C.html(dir, 'page.qmd'), /<script type="application\/json" class="ai-feedback-data">/);
}));

test('older loaders get the page\'s one feedback module through the forwarder', {skip}, () => withProject(dir => {
  installStandalone(dir);
  C.write(dir, {
    'old-consumer.lua': [
      'local chosen = pandoc.path.join({pandoc.path.directory(PANDOC_SCRIPT_FILE), "_extensions", "Erasmus-CTM", "ai-feedback", "feedback-quarto.lua"})',
      'local shared = dofile(chosen)',
      'assert(shared == _G.__ctmLibs.feedback, "a second instance")',
      'return {{Pandoc = function(doc) return shared.prepare(doc) end}}', ''].join('\n'),
    'page.qmd': '---\ntitle: t\nfilters: [Erasmus-CTM/ai-feedback, old-consumer.lua]\n---\n' + activity,
  });
}, dir => {
  const r = C.render(dir, ['page.qmd']);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(C.html(dir, 'page.qmd').match(/class="ai-feedback-data"/g).length, 1);
}));

test('the forwarder without ctm-libs next to it names both install commands', {skip}, () => withProject(dir => {
  fs.cpSync(TEMPLATE, path.join(dir, '_extensions', 'ai-feedback'), {recursive: true});
  C.write(dir, {'page.qmd': '---\ntitle: t\nfilters: [ai-feedback]\n---\n' + activity});
}, dir => {
  const r = C.render(dir, ['page.qmd']);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /ctm-libs is missing next to .*Install pyodide-interaktiv again \(quarto add Erasmus-CTM\/pyodide-interaktiv@feature\/shared-feedback-integration\) or CTM Assessment/s);
}));
