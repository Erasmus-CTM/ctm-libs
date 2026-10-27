// A build without AI feedback (P22) and the exercises that only AI feedback
// can assess. ctm-libs finds its own .ai-feedback activities; a component
// decides about its exercises with its own parser and asks ctm-libs
// (ctm.policy.withoutAI; here the probe component). Without ai-feedback:
// without-ai the build stops with one error per page naming them all; text
// shows each question without answer box or Check button, with a note;
// self-check is text for now; drop removes them. AI feedback builds are
// unchanged.
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const {JSDOM} = require('jsdom');
const C = require('./helpers/ctm-libs.cjs');
const skip = C.hasQuarto ? false : 'Quarto required';
const OFF = {CTM_FEEDBACK: 'off'};
const NOTE = 'This exercise has no automatic feedback in this version.';
const END = '_extensions/ctm-libs/ctm-libs-end.lua';
const ADVICE = 'Other pages may have such exercises too: the render stops at the first page that has one. One setting in _quarto.yml decides for every page (or put it in the profile that turns AI feedback off; a page\'s front matter decides for that page alone):\n\nai-feedback:\n  without-ai: text\n\ntext shows each question without answer box and Check button; self-check is the same as text for now (self-check comes in a later version); drop removes the exercises from their pages (a last resort).';
const MESSAGE = /AI feedback is off for this build \(([^)]*)\); ([^\n]*)\./g;

// Activities also in <details>, a tab and a collapsed callout; a hidden one
// does not count. The components' blocks are theirs: ctm-libs leaves them.
const page = (front = '') => '---\ntitle: t\n' + front + '---\n\n' + [
  '## Writing', '', 'See [the essay](#essay).', '',
  '::: {.ai-feedback #essay}', 'Write two sentences.', '', '::: {.feedback-criteria}', 'CRITERIA_MARKER_5520', ':::', ':::', '',
  '<details class="reading-step">', '<summary>Go deeper</summary>', '',
  '::: {.ai-feedback}', 'Explain the hint in your own words, please.', ':::', '', '</details>', '',
  '::: {.panel-tabset}', '### Tab', '', '::: {.ai-feedback #tabbed}', 'Compare the tabs.', ':::', '', ':::', '',
  '```{math-exercise}', '#| label: sketch', '#| mode: custom', 'Draw: _[4]', '```', '',
  '```{py-exercise}', '#| label: free', '#| task: Print anything.', 'print("hello")', '```', '',
  '::: {.callout-note collapse="true"}', '## Folded', '', '::: {.ai-feedback #folded}', 'Reflect.', ':::', ':::', '',
  '::: {.hidden}', '::: {.ai-feedback #hidden-activity}', 'Hidden.', ':::', ':::', ''].join('\n')
  // A component's exercise without a static check, asked for by the probe component.
  + C.probe('component', 'local d = ctm.policy.withoutAI({component = "probe", kind = "probe exercise without a check", name = "probe-ex", text = "Probe.", lang = "en"})\n'
    + 'return d and {action = d.action, note = d.note and pandoc.utils.stringify(d.note) or "none"} or "ai"');
const NAMES = ['essay', '"Explain the hint in your own words,…"', 'tabbed', 'folded', 'probe-ex'];
const KINDS = ['essay (AI feedback activity)', '"Explain the hint in your own words,…" (AI feedback activity)', 'tabbed (AI feedback activity)',
  'folded (AI feedback activity)', 'probe-ex (probe exercise without a check)'];

function withProject(files, run, {filters = 'ctm-libs, probe, ' + END} = {}) {
  const dir = C.tempdir('ctm-without-ai-');
  try {
    C.installPackage(dir); C.install(dir); C.installProbe(dir);
    C.write(dir, {'_quarto.yml': 'project:\n  type: default\nfilters: [' + filters + ']\n', ...files});
    return run(dir);
  } finally { fs.rmSync(dir, {recursive: true, force: true}); }
}
const setting = value => 'ai-feedback:\n  without-ai: ' + value + '\n';
const messages = stderr => [...stderr.matchAll(MESSAGE)].map(m => m[2]);
const errorOf = stderr => {
  const start = stderr.indexOf('AI feedback is off for this build');
  const end = stderr.indexOf('(a last resort).', start);
  return start >= 0 && end > start ? stderr.slice(start, end + '(a last resort).'.length) : stderr;
};

test('unset: one error per page names every such exercise, also the components\'; it says how to choose', {skip}, () => {
  withProject({'page.qmd': page()}, dir => {
    const r = C.render(dir, ['page.qmd'], OFF);
    assert.notEqual(r.status, 0);
    assert.equal(errorOf(r.stderr), 'AI feedback is off for this build (CTM_FEEDBACK=off), and page.qmd has 5 exercises that only AI feedback can assess: '
      + KINDS.join('; ') + '.\n' + ADVICE);
    assert.equal(r.stderr.match(/that only AI feedback can assess/g).length, 1, 'one error');
    assert.doesNotMatch(r.stderr, /left out on this page|shown as text/);
  });
  // Without the end filter (component development builds, filters: [ctm-libs]) the stop comes at once.
  withProject({'page.qmd': page()}, dir => {
    const r = C.render(dir, ['page.qmd'], OFF);
    assert.notEqual(r.status, 0);
    assert.match(errorOf(r.stderr), /^AI feedback is off for this build \(CTM_FEEDBACK=off\), and page\.qmd has 4 exercises that only AI feedback can assess: essay \(AI feedback activity\); "Explain the hint in your own words,…" \(AI feedback activity\); tabbed \(AI feedback activity\); folded \(AI feedback activity\)\.\n/);
  }, {filters: 'ctm-libs, probe'});
});

test('text: the questions stay, without answer box or Check button, with a note; one build message', {skip}, () => withProject({
  'page.qmd': page(setting('text') + 'py-exercise:\n  feedback: true\n'),
}, dir => {
  const r = C.render(dir, ['page.qmd'], OFF);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(messages(r.stderr), ['shown as text, without automatic feedback (without-ai: text in page.qmd): ' + NAMES.join('; ')]);
  const html = C.html(dir, 'page.qmd');
  assert.doesNotMatch(html, /CRITERIA_MARKER_5520|class="ai-feedback-data"|<textarea/);
  const doc = new JSDOM(html).window.document;
  const tasks = [...doc.querySelectorAll('.ai-feedback-task')];
  assert.deepEqual(tasks.map(t => t.id), ['essay', 'ai-feedback-2', 'tabbed', 'folded']);
  for (const task of tasks) {
    const note = task.querySelector('.ctm-without-ai');
    assert.equal(note.textContent.trim(), NOTE);
    assert.equal(note.getAttribute('lang'), null, 'the page is in English');
  }
  assert.match(doc.querySelector('#essay').textContent, /Write two sentences\./);
  assert.ok(doc.querySelector('details .ai-feedback-task'), 'the activity in <details> stays there');
  assert.ok(doc.querySelector('.tab-content #tabbed'), 'in its tab');
  assert.deepEqual(C.probes(html).component, {action: 'text', note: NOTE});
  // The components' blocks are left to the components (none here); hidden blocks are untouched.
  assert.match(html, /#\| mode: custom/);
  assert.match(html, /print\(&quot;hello&quot;\)|print\("hello"\)/);
  assert.ok(doc.querySelector('#hidden-activity.ai-feedback'));
}));

test('self-check is text for now; drop removes the exercises and warns about links; a page overrides the project', {skip}, () => withProject({
  '_quarto.yml': 'project:\n  type: default\n  render: [page.qmd, drop.qmd]\nfilters: [ctm-libs, probe, ' + END + ']\n' + setting('self-check'),
  'page.qmd': page(),
  'drop.qmd': page(setting('drop')),
}, dir => {
  const r = C.render(dir, [], OFF);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(messages(r.stderr).sort(), [
    'removed from this page (without-ai: drop in drop.qmd): ' + NAMES.join('; ') + '. Links and cross-references to them no longer resolve',
    'shown as text, without automatic feedback (without-ai: self-check in _quarto.yml; self-check comes in a later version): ' + NAMES.join('; '),
  ]);
  const text = new JSDOM(C.html(dir, 'page.qmd')).window.document;
  assert.equal(text.querySelectorAll('.ctm-without-ai').length, 4);
  assert.deepEqual(C.probes(C.html(dir, 'page.qmd')).component, {action: 'text', note: NOTE});
  const dropped = C.html(dir, 'drop.qmd');
  assert.doesNotMatch(dropped, /Write two sentences|Explain the hint|Compare the tabs|Reflect\.|ctm-without-ai|ai-feedback-task/);
  assert.deepEqual(C.probes(dropped).component, {action: 'drop', note: 'none'});
  assert.match(dropped, /href="#essay"/, 'links are left as they are');
  assert.match(dropped, /Go deeper/, 'the <details> block itself stays');
}));

test('the note speaks the exercise\'s language, marked where the page\'s differs', {skip}, () => withProject({
  'page.qmd': '---\ntitle: t\nlang: nb\n' + setting('text') + '---\n\n::: {.ai-feedback #own}\nSkriv.\n:::\n\n'
    + '::: {.ai-feedback #german ui-language="de"}\nSchreib.\n:::\n\n::: {.ai-feedback #spanish ui-language="es"}\nEscribe.\n:::\n',
}, dir => {
  const r = C.render(dir, ['page.qmd'], OFF);
  assert.equal(r.status, 0, r.stderr);
  const doc = new JSDOM(C.html(dir, 'page.qmd')).window.document;
  const note = id => doc.querySelector('#' + id + ' .ctm-without-ai');
  assert.equal(note('own').textContent.trim(), 'Denne oppgaven har ingen automatisk tilbakemelding i denne versjonen.');
  assert.equal(note('own').getAttribute('lang'), null);
  assert.equal(note('german').textContent.trim(), 'Diese Aufgabe hat in dieser Version keine automatische Rückmeldung.');
  assert.equal(note('german').getAttribute('lang'), 'de');
  assert.equal(note('spanish').textContent.trim(), NOTE, 'no Spanish text: English');
  assert.equal(note('spanish').getAttribute('lang'), 'en');
}));

test('a project stops at its first page with such exercises; the error names an including page as such', {skip}, () => withProject({
  '_quarto.yml': 'project:\n  type: default\n  render: [a.qmd, b.qmd]\nfilters: [ctm-libs, probe, ' + END + ']\n',
  'a.qmd': '---\ntitle: a\n---\n\nIntro.\n\n{{< include _part.qmd >}}\n',
  '_part.qmd': '::: {.ai-feedback #included-essay}\nIncluded.\n:::\n',
  'b.qmd': '---\ntitle: b\n---\n\n::: {.ai-feedback #b-essay}\nSecond page.\n:::\n',
}, dir => {
  const r = C.render(dir, [], OFF);
  assert.notEqual(r.status, 0);
  const error = errorOf(r.stderr);
  assert.ok(error.startsWith('AI feedback is off for this build (CTM_FEEDBACK=off), and a.qmd (or a file it includes) has an exercise that only AI feedback can assess: included-essay (AI feedback activity).\n' + ADVICE), error);
  assert.doesNotMatch(r.stderr, /b-essay/, 'the render stops at the first page');
  // The setting in _quarto.yml decides for every page.
  fs.appendFileSync(path.join(dir, '_quarto.yml'), setting('text'));
  const ok = C.render(dir, [], OFF);
  assert.equal(ok.status, 0, ok.stderr);
  assert.deepEqual(messages(ok.stderr).sort(), ['shown as text, without automatic feedback (without-ai: text in _quarto.yml): b-essay',
    'shown as text, without automatic feedback (without-ai: text in _quarto.yml): included-essay']);
}));

test('the end filter listed before a CTM filter stops a build without AI feedback and warns in one with it, naming the order', {skip}, () => {
  const ORDER = /ctm-libs-end\.lua ran before ctm-libs' preparation on this page\. List it last, after every CTM filter, as the package does \(filters: \[ctm-assessment\] runs ctm-libs, jsxgraph, math-exercise, ctm-stack, py-exercise, pyodide-interaktiv, then ctm-libs-end\.lua\)\./g;
  withProject({'page.qmd': page(setting('text'))}, dir => {
    let r = C.render(dir, ['page.qmd'], OFF);
    assert.notEqual(r.status, 0);
    assert.equal(r.stderr.match(ORDER)?.length, 1, r.stderr);
    // With AI feedback the build goes on as it did, with one warning.
    r = C.render(dir, ['page.qmd']);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stderr, /\(W\) ctm-libs-end\.lua ran before ctm-libs' preparation on this page/);
    assert.equal(r.stderr.match(ORDER)?.length, 1, r.stderr);
    assert.equal(new JSDOM(C.html(dir, 'page.qmd')).window.document.querySelectorAll('.ai-feedback-activity').length, 4);
  }, {filters: END + ', ctm-libs, probe'});
  withProject({'page.qmd': page(setting('text'))}, dir => {
    let r = C.render(dir, ['page.qmd'], OFF);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /ctm-libs-end\.lua ran before probe on this page\. List it last/);
    r = C.render(dir, ['page.qmd']);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stderr.match(/ctm-libs-end\.lua ran before probe on this page\. List it last/g)?.length, 1, r.stderr);
    assert.equal(C.probes(C.html(dir, 'page.qmd')).component, 'ai');
  }, {filters: 'ctm-libs, ' + END + ', probe'});
});

test('an unknown value stops both builds, naming the allowed values; AI feedback builds are unchanged', {skip}, () => withProject({
  'page.qmd': page(setting('hide')),
}, dir => {
  for (const env of [OFF, {}]) {
    const r = C.render(dir, ['page.qmd'], env);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /ai-feedback: without-ai must be text, self-check or drop \(found hide in page\.qmd\)/);
  }
  fs.writeFileSync(path.join(dir, 'page.qmd'), page());
  const r = C.render(dir, ['page.qmd']);
  assert.equal(r.status, 0, r.stderr);
  assert.doesNotMatch(r.stderr, /only AI feedback can assess|AI feedback is off/);
  const html = C.html(dir, 'page.qmd');
  assert.equal(new JSDOM(html).window.document.querySelectorAll('.ai-feedback-activity').length, 4);
  assert.doesNotMatch(html, /ctm-without-ai|ai-feedback-task/);
  assert.equal(C.probes(html).component, 'ai');
}));
