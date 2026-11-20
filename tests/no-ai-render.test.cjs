// P22: one source builds a site without AI feedback (ai-feedback: enabled:
// false in a profile, or CTM_FEEDBACK=off). Nothing of AI feedback reaches
// the HTML; activities keep their visible task; pages that asked for
// feedback get one build message; policies are validated in both builds.
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const C = require('./helpers/ctm-libs.cjs');
const skip = C.hasQuarto ? false : 'Quarto required';
const MARKERS = /CRITERIA_MARKER_4412|STARTER_MARKER_9183|POLICY_MARKER_7731/;
const MESSAGE = /AI feedback is off for this build \(([^)]*\)?)\); ([^\n]*)\./g;

const activity = [
  '## Spanish', '', 'Context prose with $x^2$.', '',
  '::: {#notes .ai-feedback-context}', 'Notes with $y^3$.', ':::', '',
  '::: {.callout-note .ai-feedback-ignore}', 'Hidden note.', ':::', '',
  '::: {.ai-feedback #essay feedback-policy="course" context="notes"}', 'Write two sentences about $z$.', '',
  '::: {.feedback-source}', 'Source with $s$.', ':::', '',
  '::: {.feedback-criteria}', 'CRITERIA_MARKER_4412', ':::', '',
  '::: {.feedback-starter}', 'STARTER_MARKER_9183', ':::', ':::', '',
  '```python', 'print(1)', '```', '',
  // Hidden and author-only activities pass through the walk; their criteria and starters must go too.
  '::: {.ai-feedback .hidden}', 'Hidden task.', '', '::: {.feedback-criteria}', 'CRITERIA_MARKER_4412 hidden class', ':::', '', '::: {.feedback-starter}', 'STARTER_MARKER_9183 hidden class', ':::', ':::', '',
  '::: {.ai-feedback hidden="hidden"}', 'Hidden task.', '', '::: {.feedback-criteria}', 'CRITERIA_MARKER_4412 hidden attribute', ':::', ':::', '',
  '::: {.ai-feedback style="display: none"}', 'Hidden task.', '', '::: {.feedback-starter}', 'STARTER_MARKER_9183 display none', ':::', ':::', '',
  '::: {.example-author-notes}', '::: {.ai-feedback}', 'Author example.', '', '::: {.feedback-criteria}', 'CRITERIA_MARKER_4412 author notes', ':::', ':::', ':::', ''].join('\n');
const probes = C.probe('switch', 'return {ctm.feedback.enabled()}')
  + C.probe('request', 'return ctm.feedback.request("math-exercise", true, "feedback: auto")')
  + C.probe('declined', 'return ctm.feedback.request("py-exercise", false, "feedback: false")')
  + C.probe('selection', 'local b = pandoc.CodeBlock("x", pandoc.Attr("ex1")); return {ctm.feedback.selection(b, {["feedback-policy"] = "course"}), ctm.feedback.context(b, {context = "notes"})}');

function withProject(run) {
  const dir = C.tempdir('ctm-no-ai-');
  try {
    C.installPackage(dir); C.install(dir); C.installProbe(dir);
    C.write(dir, {
      '_quarto.yml': 'project:\n  type: default\n  render: [activity.qmd, asks.qmd, plain.qmd, pyodide.qmd, pyodide-asks.qmd]\nfilters: [ctm-libs, probe]\n'
        + 'ai-feedback:\n  mode: api\n  base-url: https://llm.example.edu/v1\n  model: course-model\n  policy-files: policies.yml\n  project-policy: course\n  without-ai: text\n',
      '_quarto-no-ai.yml': 'ai-feedback:\n  enabled: false\n',
      'policies.yml': 'ai-feedback:\n  policies:\n    course:\n      base-prompt: POLICY_MARKER_7731\n',
      'activity.qmd': '---\ntitle: Activity\n---\n' + activity + probes,
      'asks.qmd': '---\ntitle: Asks\nai-feedback:\n  enabled: true\n---\nText.\n',
      'plain.qmd': '---\ntitle: Plain\n---\nNo feedback here.\n',
      'pyodide.qmd': '---\ntitle: Pyodide\n---\n```{pyodide-python}\nprint(1)\n```\n' + C.probe('pyodide', 'return {meta.pyodide and meta.pyodide.feedback}'),
      'pyodide-asks.qmd': '---\ntitle: Pyodide asks\npyodide:\n  feedback: true\n---\n```{pyodide-python}\nprint(1)\n```\n' + C.probe('pyodide', 'ctm.feedback.request("pyodide-interaktiv", true); return {meta.pyodide and meta.pyodide.feedback}'),
    });
    return run(dir);
  } finally { fs.rmSync(dir, {recursive: true, force: true}); }
}
function files(dir) {
  return fs.readdirSync(dir, {recursive: true}).map(String).filter(name => !name.startsWith('_extensions'));
}
function checkOff(dir, reason) {
  assert.deepEqual(files(dir).filter(name => /ai-feedback-\d|feedback-core\.js|feedback-dom\.js|ai-feedback\.js|ai-feedback\.css/.test(name)), []);
  for (const page of ['activity.qmd', 'asks.qmd', 'plain.qmd', 'pyodide.qmd', 'pyodide-asks.qmd']) {
    const html = C.html(dir, page);
    assert.doesNotMatch(html, /window\.__aiFeedbackConfig =|window\.__aiFeedbackPolicies|feedback-core\.js|ai-feedback\.css/, page);
    assert.doesNotMatch(html, /class="ai-feedback-data"|data-ai-feedback-context|data-ai-feedback-tex/, page);
    assert.doesNotMatch(html, MARKERS, page);
  }
  const html = C.html(dir, 'activity.qmd');
  const start = html.indexOf('<div id="essay" class="ai-feedback-task">');
  assert.ok(start > 0, 'the activity is a task');
  const task = html.slice(start, html.indexOf('code-copy-outer-scaffold', start));
  assert.match(task, /Write two sentences about/);
  assert.match(task, /Source with/);
  assert.doesNotMatch(task, /<textarea|<noscript|<button/);
  const p = C.probes(html);
  assert.deepEqual(p.switch, [false, reason]);
  assert.equal(p.request, false);
  assert.equal(p.declined, false);
  assert.deepEqual(p.selection, [{exercise: 'ex1', name: ''}, {mode: 'none', refs: '', text: ''}]);
  assert.deepEqual(C.probes(C.html(dir, 'pyodide.qmd')).pyodide, []);
  assert.deepEqual(C.probes(C.html(dir, 'pyodide-asks.qmd')).pyodide, [true]);
}
// Each page's message: its exercises shown as text (shown), and what it asked
// for but did not get (items).
function messages(stderr) {
  return [...stderr.matchAll(MESSAGE)].map(([, reason, tail]) => {
    const left = /(?:^|\. )[Ll]eft out on this page: (.*)$/.exec(tail);
    return {reason, shown: left ? tail.slice(0, left.index) : tail, items: left ? left[1] : ''};
  });
}

test('a profile with ai-feedback: enabled: false builds the site without AI feedback', {skip}, () => withProject(dir => {
  const r = C.render(dir, ['--profile', 'no-ai']);
  assert.equal(r.status, 0, r.stderr);
  checkOff(dir, 'ai-feedback: enabled: false (_quarto-no-ai.yml)');
  const found = messages(r.stderr);
  assert.deepEqual(found.map(m => m.reason), Array(3).fill('ai-feedback: enabled: false (_quarto-no-ai.yml)'));
  assert.deepEqual(found.map(m => m.items).sort(), [
    'ai-feedback: enabled: true (asks.qmd)',
    'math-exercise feedback (feedback: auto)',
    'pyodide-interaktiv feedback',
  ]);
  assert.deepEqual(found.map(m => m.shown).filter(Boolean), ['shown as text, without automatic feedback (without-ai: text in _quarto.yml): essay']);
}));

test('CTM_FEEDBACK=off does the same without any metadata, with the same build messages', {skip}, () => withProject(dir => {
  const r = C.render(dir, [], {CTM_FEEDBACK: 'off'});
  assert.equal(r.status, 0, r.stderr);
  checkOff(dir, 'CTM_FEEDBACK=off');
  const found = messages(r.stderr);
  assert.deepEqual(found.map(m => m.reason), Array(3).fill('CTM_FEEDBACK=off'));
  assert.deepEqual(found.map(m => m.items).sort(), [
    'ai-feedback: enabled: true (asks.qmd)',
    'math-exercise feedback (feedback: auto)',
    'pyodide-interaktiv feedback',
  ]);
  assert.deepEqual(found.map(m => m.shown).filter(Boolean), ['shown as text, without automatic feedback (without-ai: text in _quarto.yml): essay']);
}));

// pyodide-interaktiv's own default (feedback on unless pyodide: feedback:
// false) is no request; only an explicit pyodide: feedback: true is named.
test('Pyodide pages are named only under an explicit pyodide: feedback: true', {skip}, () => withProject(dir => {
  for (const [page, items] of [['pyodide.qmd', []], ['pyodide-asks.qmd', ['pyodide-interaktiv feedback']]]) {
    const r = C.render(dir, [page], {CTM_FEEDBACK: 'off'});
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(messages(r.stderr).map(m => m.items), items, page);
  }
}));

// Only what is on the page is a request: a project-wide or folder-wide
// enabled: true is configuration, and pages without AI content stay quiet.
function withSite(run) {
  const dir = C.tempdir('ctm-no-ai-site-');
  try {
    C.installPackage(dir); C.install(dir); C.installProbe(dir);
    C.write(dir, {
      '_quarto.yml': 'project:\n  type: website\nfilters: [ctm-libs, probe, _extensions/ctm-libs/ctm-libs-end.lua]\nai-feedback:\n  enabled: true\n  without-ai: text\n',
      '_quarto-no-ai.yml': 'ai-feedback:\n  enabled: false\n',
      'index.qmd': '---\ntitle: Home\n---\nNo feedback here.\n',
      'own.qmd': '---\ntitle: Own\nai-feedback:\n  enabled: true\n---\nAlso no activity.\n',
      'sub/_metadata.yml': 'ai-feedback:\n  enabled: true\n',
      'sub/chapter.qmd': '---\ntitle: Chapter\n---\nNothing either.\n',
      'sub/activity.qmd': '---\ntitle: Activity\n---\n\n::: {.ai-feedback}\nExplain.\n:::\n',
    });
    return run(dir);
  } finally { fs.rmSync(dir, {recursive: true, force: true}); }
}
for (const [label, args, env, reason] of [['--profile no-ai', ['--profile', 'no-ai'], {}, 'ai-feedback: enabled: false (_quarto-no-ai.yml)'],
  ['CTM_FEEDBACK=off', [], {CTM_FEEDBACK: 'off'}, 'CTM_FEEDBACK=off']]) {
  test('build messages name only what is on the page (' + label + ')', {skip}, () => withSite(dir => {
    const r = C.render(dir, args, env);
    assert.equal(r.status, 0, r.stderr);
    const found = messages(r.stderr);
    assert.deepEqual(found.map(m => m.reason), [reason, reason]);
    assert.deepEqual(found.map(m => m.items).sort(), ['', 'ai-feedback: enabled: true (own.qmd)']);
    assert.deepEqual(found.map(m => m.shown).filter(Boolean), ['shown as text, without automatic feedback (without-ai: text in _quarto.yml): "Explain."']);
    assert.doesNotMatch(r.stderr, /enabled: true \((_quarto\.yml|sub\/_metadata\.yml|document metadata)\)/);
  }));
}

test('flush() prints the message once, at once; the end filter and the fallback do not repeat it', {skip}, () => {
  const dir = C.tempdir('ctm-no-ai-flush-');
  try {
    C.installPackage(dir); C.install(dir); C.installProbe(dir);
    C.write(dir, {
      'early.qmd': '---\ntitle: t\nfilters: [ctm-libs, probe, _extensions/ctm-libs/ctm-libs-end.lua]\n---\n'
        + C.probe('flush', 'ctm.feedback.request("math-exercise", true, "feedback: auto"); return {ctm.feedback.flush(), ctm.feedback.flush()}'),
      'fallback.qmd': '---\ntitle: t\nfilters: [ctm-libs, probe]\n---\n' + C.probe('ask', 'return ctm.feedback.request("py-exercise", true, "feedback: true")'),
    });
    for (const [file, item] of [['early.qmd', 'math-exercise feedback (feedback: auto)'], ['fallback.qmd', 'py-exercise feedback (feedback: true)']]) {
      const r = C.render(dir, [file], {CTM_FEEDBACK: 'off'});
      assert.equal(r.status, 0, r.stderr);
      assert.deepEqual(messages(r.stderr).map(m => m.items), [item], file);
    }
    assert.deepEqual(C.probes(C.html(dir, 'early.qmd')).flush, [true, false]);
  } finally { fs.rmSync(dir, {recursive: true, force: true}); }
});

test('the end filter prints the message: nothing is left for a filter after it', {skip}, () => {
  const dir = C.tempdir('ctm-no-ai-end-');
  try {
    C.installPackage(dir); C.install(dir); C.installProbe(dir);
    const ask = C.probe('ask', 'return ctm.feedback.request("math-exercise", true, "feedback: auto")');
    C.write(dir, {
      // Runs after the filters before it and reports whether anything was still to print.
      'after.lua': 'return {{Pandoc = function(doc)\n  local ctm = rawget(_G, "__ctmLibs")\n  local left = ctm.feedback.flush()\n'
        + '  doc.blocks:insert(pandoc.RawBlock("html", \'<script type="application/json" class="ctm-probe" data-name="after">\' .. tostring(left) .. "</script>"))\n'
        + '  return doc\nend}}\n',
      'ended.qmd': '---\ntitle: t\nfilters: [ctm-libs, probe, _extensions/ctm-libs/ctm-libs-end.lua, after.lua]\n---\n' + ask,
      'unended.qmd': '---\ntitle: t\nfilters: [ctm-libs, probe, after.lua]\n---\n' + ask,
    });
    for (const [file, left] of [['ended.qmd', false], ['unended.qmd', true]]) {
      const r = C.render(dir, [file], {CTM_FEEDBACK: 'off'});
      assert.equal(r.status, 0, r.stderr);
      assert.equal(C.probes(C.html(dir, file)).after, left, file);
      assert.deepEqual(messages(r.stderr).map(m => m.items), ['math-exercise feedback (feedback: auto)'], file);
    }
  } finally { fs.rmSync(dir, {recursive: true, force: true}); }
});

test('the normal build keeps AI feedback; an unknown CTM_FEEDBACK value warns', {skip}, () => withProject(dir => {
  const r = C.render(dir, [], {CTM_FEEDBACK: 'maybe'});
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stderr, /CTM_FEEDBACK=maybe is not understood \(use off\); AI feedback follows the project's settings\./);
  assert.equal(messages(r.stderr).length, 0);
  const html = C.html(dir, 'activity.qmd');
  assert.match(html, /window\.__aiFeedbackConfig = /);
  assert.match(html, /POLICY_MARKER_7731/);
  assert.match(html, /class="ai-feedback-data"/);
  assert.match(html, /data-ai-feedback-tex/);
  const p = C.probes(html);
  assert.deepEqual(p.switch, [true]);
  assert.equal(p.request, true);
  assert.equal(p.selection[0].name, 'course');
  assert.deepEqual(C.probes(C.html(dir, 'pyodide.qmd')).pyodide, []);  // no pyodide metadata
}));

test('policies and switch values are checked in both builds', {skip}, () => withProject(dir => {
  fs.writeFileSync(path.join(dir, 'policies.yml'), 'ai-feedback:\n  policies:\n    course:\n      prompt: OLD\n');
  let r = C.render(dir, ['--profile', 'no-ai']);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /use base-prompt instead of prompt/);
  fs.writeFileSync(path.join(dir, 'policies.yml'), 'ai-feedback:\n  policies:\n    course:\n      max-words: 90\n');
  fs.writeFileSync(path.join(dir, '_quarto-no-ai.yml'), 'ai-feedback:\n  enabled: no-thanks\n');
  r = C.render(dir, ['--profile', 'no-ai']);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /ai-feedback: enabled \(_quarto-no-ai\.yml\) must be true or false \(found "no-thanks"\)/);
}));

// M18: Quarto's merged metadata loses metadata-files and format-scoped
// metadata when the page has its own ai-feedback map; enabled: false there
// still turns AI feedback off, at every level.
test('enabled: false in metadata-files or format-scoped metadata survives a page\'s own ai-feedback map', {skip}, () => {
  const off = 'ai-feedback:\n  enabled: false\n';
  const cases = [
    ['metadata-files', 'metadata-files: [off.yml]\n', {'off.yml': off}, '', 'off.yml'],
    ['format scope', 'format:\n  html:\n    ai-feedback:\n      enabled: false\n', {}, '', '_quarto.yml (format.html)'],
    ['format-scoped metadata-files', 'format:\n  html:\n    metadata-files: [off.yml]\n', {'off.yml': off}, '', 'off.yml'],
    ['the page\'s format scope', '', {}, 'format:\n  html:\n    ai-feedback:\n      enabled: false\n', 'page.qmd (format.html)'],
  ];
  for (const [name, config, files, front, origin] of cases) {
    const dir = C.tempdir('ctm-no-ai-');
    try {
      C.install(dir); C.installProbe(dir);
      C.write(dir, {...files,
        '_quarto.yml': 'project:\n  type: default\n  render: [page.qmd]\nfilters: [ctm-libs, probe]\n' + config,
        'page.qmd': '---\ntitle: Page\n' + front + 'ai-feedback:\n  enabled: true\n  mode: api\n---\n' + C.probe('switch', 'return {ctm.feedback.enabled()}')});
      const r = C.render(dir, [], {CTM_COMPONENT_DEV: '1'}); assert.equal(r.status, 0, name + ': ' + r.stderr);
      assert.deepEqual(C.probes(C.html(dir, 'page.qmd')).switch, [false, 'ai-feedback: enabled: false (' + origin + ')'], name);
    } finally { fs.rmSync(dir, {recursive: true, force: true}); }
  }
});
