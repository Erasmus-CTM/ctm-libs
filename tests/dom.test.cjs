const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const fixtures = require('./fixtures.cjs');
function page(html = '') {
  const dom = new JSDOM('<main>' + html + '</main>', { url: 'https://example.invalid/course', runScripts: 'outside-only' });
  const w = dom.window;
  w.AbortController = AbortController;
  for (const file of ['feedback-core.js', 'feedback-dom.js', 'ai-feedback.js']) w.eval(fs.readFileSync(path.join(__dirname, '../_extensions/ctm-libs/feedback', file), 'utf8'));
  return { dom, w, F: w.AIFeedback };
}
test('canonical and legacy contexts deduplicate and preserve LaTeX source', () => {
  const { w, F } = page('<div id="a" class="ai-feedback-context math-exercise-context">Area <span data-ai-feedback-tex="r^2">garbled</span><span hidden>secret</span><textarea>draft</textarea></div><div id="b" class="math-exercise-context">Legacy</div>');
  const contexts = F.collectExplicitContexts('a,b,a');
  assert.equal(contexts.length, 2); assert.match(contexts[0].content, /\\\(r\^2\\\)/); assert.doesNotMatch(contexts[0].content, /garbled|secret|draft/);
  w.close();
});
test('mixed lesson context excludes STACK cards while preserving prose and each component own task', () => {
  const {w, F} = page('<section id="lesson"><p>Before the exercises: <span data-ai-feedback-tex="x^2">rendered glyphs</span>.</p>'
    + '<section class="ctm-stack"><div class="stack-prompt">STACK task only.</div>'
    + '<input value="typed answer"><div class="stack-result">Private grading evidence.</div>'
    + '<button>Check answer</button><script type="application/json">{"teacher":"hidden payload"}</script></section>'
    + '<div class="math-exercise-cell">Math task only.</div><div class="py-exercise-cell">Python task only.</div>'
    + '<div class="qpyodide-interactive-area">Python code only.</div><p>After the exercises.</p></section>');
  try {
    const context = F.contextText(w.document.getElementById('lesson'));
    assert.equal(context, 'Before the exercises: \\(x^2\\).\nAfter the exercises.');
    assert.doesNotMatch(context, /STACK|Private|Check answer|teacher|hidden payload|typed answer|Math task|Python task|Python code|rendered glyphs/);
    // A component explicitly reads its prompt, rather than the whole card.
    assert.equal(F.contextText(w.document.querySelector('.stack-prompt')), 'STACK task only.');
  } finally { w.close(); }
});
test('Markdown rendering never activates model HTML', () => {
  const { F, w } = page();
  const el = w.document.createElement('div'); el.innerHTML = F.renderMarkdown('<img src=x onerror=alert(1)> **word**');
  assert.equal(el.querySelector('img'), null); assert.equal(el.querySelector('strong').textContent, 'word'); w.close();
});
test('feedback renders ATX headings and removes closing hashes without changing literal content', () => {
  const { F, w } = page();
  const el = w.document.createElement('div');
  el.innerHTML = F.renderMarkdown('Before\n\n## **Next step** ##\nTry again.\n### Check $x^2$ ###\n#### Keep C#\n##### Escaped \\#\n###### <img src=x onerror=alert(1)> ######\n\n#tag\n####### literal\n\n`## code ##`\n\n```text\n## literal ##\n```');
  assert.equal(el.querySelector('h2').textContent, 'Next step');
  assert.equal(el.querySelector('h2 strong').textContent, 'Next step');
  assert.equal(el.querySelector('h3 .ai-feedback-math').dataset.tex, 'x^2');
  assert.equal(el.querySelector('h4').textContent, 'Keep C#');
  assert.equal(el.querySelector('h5').textContent, 'Escaped \\#');
  assert.equal(el.querySelector('img'), null);
  assert.equal(el.querySelector('h6').textContent, '<img src=x onerror=alert(1)>');
  assert.match(el.textContent, /#tag ####### literal/);
  assert.equal(el.querySelector('code').textContent, '## code ##');
  assert.equal(el.querySelector('pre code').textContent, '## literal ##');
  assert.equal(el.querySelector('h2').previousElementSibling.textContent, 'Before');
  assert.equal(el.querySelector('h2').nextElementSibling.textContent, 'Try again.');
  w.close();
});
test('feedback preserves inline/display TeX through Markdown and leaves code literal', () => {
  const {F, w} = page();
  const el = w.document.createElement('div');
  el.innerHTML = F.renderMarkdown(String.raw`Area $\pi \times r^2$, not $\pi \times r$. Also \(x_1 * x_2\).

$$
\begin{aligned}a &= b \\ c &= d\end{aligned}
$$

\[y = |x|\]

Code: \`$literal$\`.

\`\`\`python
print("$not_math$")
\`\`\`

**Keep prose bold.** <img src=x onerror=alert(1)>`.replace(/\\`/g, '`'));
  const math = [...el.querySelectorAll('.ai-feedback-math')];
  assert.equal(math.length, 5);
  assert.equal(math[0].dataset.tex, String.raw`\pi \times r^2`);
  assert.equal(math[2].dataset.tex, 'x_1 * x_2');
  assert.equal(math[3].dataset.display, 'true');
  assert.match(math[3].dataset.tex, /begin\{aligned\}/);
  assert.equal(math[4].dataset.tex, 'y = |x|');
  assert.equal(el.querySelector('code').textContent, '$literal$');
  assert.equal(el.querySelector('pre code').textContent, 'print("$not_math$")');
  assert.equal(el.querySelector('strong').textContent, 'Keep prose bold.');
  assert.equal(el.querySelector('img'), null);
  w.close();
});
test('shared attach typesets feedback after insertion but never typesets copy prompts', async () => {
  const {F, w} = page('<button>Feedback</button><div id="out"></div>');
  let calls = 0;
  F.typesetFeedback = async body => { calls++; assert.ok(body.isConnected); assert.equal(body.querySelector('.ai-feedback-math').dataset.tex, 'r^2'); };
  const options = {button: w.document.querySelector('button'), output: w.document.querySelector('#out'), getRequest: () => fixtures.writing};
  const api = F.attach({...options, client: {request: async () => ({text: '$r^2$', format: 'markdown'})}});
  await api.request(); assert.equal(calls, 1); api.dispose();
  const copy = F.attach(options); await copy.request(); assert.equal(calls, 1); copy.dispose(); w.close();
});
test('attach discards responses for edited work and failed requests do not advance hints', async () => {
  const { F, w } = page('<button>Feedback</button><div id="out"></div>');
  let request = structuredClone(fixtures.mathematics), finish;
  const adapter = F.attach({ id: 'exercise', button: w.document.querySelector('button'), output: w.document.querySelector('#out'), getRequest: () => request,
    client: { request: () => new Promise(resolve => { finish = resolve; }) } });
  const pending = adapter.request(); await new Promise(resolve => setImmediate(resolve));
  request = { ...request, task: 'Changed task' }; finish({ text: 'Old feedback.', format: 'markdown' }); await pending;
  assert.match(w.document.querySelector('#out').textContent, /changed/);
  assert.equal(w.sessionStorage.getItem('ai-feedback-hints-v2|/course|exercise'), null);
  adapter.dispose(); w.close();
});
test('copy-mode attachment needs no API call and advances hints only after display', async () => {
  const { F, w } = page('<button>Feedback</button><div id="out"></div>');
  w.fetch = () => { throw new Error('No API call expected.'); };
  const adapter = F.attach({ id: 'exercise', button: w.document.querySelector('button'), output: w.document.querySelector('#out'), getRequest: () => fixtures.mathematics });
  await adapter.request();
  assert.match(w.document.querySelector('pre').textContent, /diagnostic question/);
  assert.equal(w.sessionStorage.getItem('ai-feedback-hints-v2|/course|exercise'), '1');
  adapter.dispose(); w.close();
});
test('saved credentials stay out of prompts and legacy configs require explicit migration', () => {
  const { F, w } = page();
  w.localStorage.setItem('math-exercise-llm-config', JSON.stringify({ baseUrl: 'https://old.invalid', apiKey: 'secret' }));
  assert.equal(F.loadConfig().apiKey, '');
  F.buildSettings(); assert.match(w.document.body.textContent, /math-exercise/);
  assert.doesNotMatch(F.buildPrompt(fixtures.writing), /secret/); w.close();
});
test('all cogwheels open one shared dialog and saved settings are website-wide', () => {
  const { F, w } = page();
  const first = F.settingsButton(), second = F.settingsButton();
  w.document.body.append(first, second); first.click(); second.click();
  assert.equal(w.document.querySelectorAll('dialog.ai-feedback-settings').length, 1);
  F.saveConfig({ baseUrl: 'https://institution.invalid/v1', model: 'institution-model', apiKey: 'private-test-key', storage: 'local', mode: 'api' });
  assert.equal(JSON.parse(w.localStorage.getItem('ai-feedback-config-v1')).model, 'institution-model');
  w.localStorage.setItem('ai-feedback-config-v1', JSON.stringify({ model: 'changed-in-another-tab' }));
  assert.equal(F.loadConfig().model, 'changed-in-another-tab');
  w.close();
});

test('cancel during the final async snapshot prevents rendering and hint advancement', async () => {
  const {F, w} = page('<button>Feedback</button><div id="out"></div>');
  let calls = 0, finish;
  const request = structuredClone(fixtures.mathematics);
  const adapter = F.attach({id: 'cancel-snapshot', button: w.document.querySelector('button'), output: w.document.querySelector('#out'),
    getRequest: () => ++calls === 1 ? request : new Promise(resolve => {finish = resolve;}),
    client: {request: async () => ({text: 'OLD FEEDBACK', format: 'markdown'})}});
  const pending = adapter.request(); await new Promise(resolve => setImmediate(resolve));
  adapter.cancel(); finish(request); await pending;
  assert.doesNotMatch(w.document.querySelector('#out').textContent, /OLD FEEDBACK/);
  assert.equal(w.sessionStorage.getItem('ai-feedback-hints-v2|/course|cancel-snapshot'), null);
  adapter.dispose(); w.close();
});

test('feedback policy changes make a pending response stale', async () => {
  const {F, w} = page('<button>Feedback</button><div id="out"></div>');
  let request = structuredClone(fixtures.mathematics), finish;
  const adapter = F.attach({id: 'policy', button: w.document.querySelector('button'), output: w.document.querySelector('#out'), getRequest: () => request,
    client: {request: () => new Promise(resolve => {finish = resolve;})}});
  const pending = adapter.request(); await new Promise(resolve => setImmediate(resolve));
  request = {...request, feedback: {...request.feedback, language: 'en'}};
  finish({text: 'OLD FEEDBACK', format: 'markdown'}); await pending;
  assert.match(w.document.querySelector('#out').textContent, /changed/);
  assert.equal(w.sessionStorage.getItem('ai-feedback-hints-v2|/course|policy'), null);
  adapter.dispose(); w.close();
});

test('cancelling while math is typesetting does not consume a hint', async () => {
  const {F, w} = page('<button>Feedback</button><div id="out"></div>');
  let finish;
  F.typesetFeedback = () => new Promise(resolve => {finish = resolve;});
  const adapter = F.attach({id: 'typeset', button: w.document.querySelector('button'), output: w.document.querySelector('#out'), getRequest: () => fixtures.mathematics,
    client: {request: async () => ({text: '$x^2$', format: 'markdown'})}});
  const pending = adapter.request(); await new Promise(resolve => setImmediate(resolve));
  adapter.cancel(); finish(); await pending;
  assert.equal(w.sessionStorage.getItem('ai-feedback-hints-v2|/course|typeset'), null);
  assert.equal(w.document.querySelector('#out .ai-feedback-body'), null);
  adapter.dispose(); w.close();
});

test('over-escaped provider math renders while ordinary matrix row breaks and code stay intact', () => {
  const {F, w} = page();
  const katex = require('katex');
  const el = w.document.createElement('div');
  const gradient = String.raw`\nabla f = \left(\frac{\partial f}{\partial x}, \frac{\partial f}{\partial y}\right)`;
  const matrix = String.raw`\begin{pmatrix}a&b\\c&d\end{pmatrix}`;
  const escaped = value => value.replaceAll('\\', '\\\\');
  const fixtures = [String.raw`\\(x\\)`, String.raw`\\(x^2\\)`, String.raw`\\(` + escaped(gradient) + String.raw`\\)`,
    String.raw`\\[` + escaped(matrix) + String.raw`\\]`,
    String.raw`\[` + matrix + String.raw`\]`,
    String.raw`\\[` + matrix + String.raw`\\]`];
  el.innerHTML = F.renderMarkdown(fixtures.join('\n\n') + '\n\n`' + fixtures[2] + '`\n\n```tex\n' + fixtures[3] + '\n```');
  const nodes = [...el.querySelectorAll('.ai-feedback-math')];
  assert.deepEqual(nodes.map(node => node.dataset.tex), ['x', 'x^2', gradient, matrix, matrix, matrix]);
  for (const node of nodes) node.innerHTML = katex.renderToString(node.dataset.tex, {throwOnError: true, trust: false, displayMode: node.dataset.display === 'true'});
  assert.equal(el.querySelectorAll('.katex').length, 6);
  assert.equal(el.querySelectorAll('.katex-error').length, 0);
  assert.equal(el.querySelector('code').textContent, fixtures[2]);
  assert.equal(el.querySelector('pre code').textContent, fixtures[3]);
  // The old parser left a backslash before each partially matched math token.
  assert.equal([...el.querySelectorAll('p')].flatMap(p => [...p.childNodes]).filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim(), '');
  w.close();
});

test('teaching criteria show literal TeX delimiters rather than JSON-escaped instructions', () => {
  const {F, w} = page();
  const criterion = String.raw`Use \(x\) or \[x^2\], preserving \frac{a}{b}.`;
  const messages = F.buildMessages({...fixtures.mathematics, criteria: [criterion]});
  assert.ok(messages[0].content.includes(criterion));
  assert.ok(!messages[0].content.includes(criterion.replaceAll('\\', '\\\\')));
  assert.ok(F.buildPrompt({...fixtures.mathematics, criteria: [criterion]}).includes(criterion));
  w.close();
});

for (const stage of ['network', 'snapshot', 'typeset']) test('quiet cancellation stays empty during ' + stage, async () => {
  const {F, w} = page('<button>Feedback</button><div id="out"></div>');
  let finish, calls = 0;
  const pause = () => new Promise(resolve => {finish = resolve;});
  if (stage === 'typeset') F.typesetFeedback = pause;
  const request = fixtures.mathematics;
  const reply = {text: '$x^2$', format: 'markdown'};
  const handle = F.attach({id: stage, button: w.document.querySelector('button'), output: w.document.querySelector('#out'),
    getRequest: () => ++calls === 2 && stage === 'snapshot' ? pause() : request,
    client: {request: () => stage === 'network' ? pause() : reply}});
  const pending = handle.request(); await new Promise(resolve => setImmediate(resolve));
  handle.cancel({clearOutput: true}); finish(stage === 'network' ? reply : request); await pending;
  assert.equal(w.document.querySelector('#out').textContent, '');
  assert.equal(w.sessionStorage.getItem('ai-feedback-hints-v2|/course|' + stage), null);
  assert.equal(w.document.querySelector('button').disabled, false);
  handle.dispose(); w.close();
});
test('explicit context excludes live Python editors, output and feedback', () => {
  const {F,w} = page('<div id="context" class="ai-feedback-context">Area <span data-ai-feedback-tex="r^2">math</span><div class="py-exercise-cell">HIDDEN_TEST</div><div class="qpyodide-interactive-area">OLD_CODE OLD_REPLY</div><div class="qpyodide-non-interactive-area">SETUP_OUTPUT</div></div>');
  const content = F.collectExplicitContexts('context')[0].content;
  assert.match(content, /r\^2/); assert.doesNotMatch(content, /HIDDEN_TEST|OLD_CODE|OLD_REPLY|SETUP_OUTPUT/); w.close();
});
test('Norwegian legacy locale uses shared Norwegian settings', () => {
  const {F,w} = page(); w.document.documentElement.lang = 'no';
  F.buildSettings(); assert.match(w.document.querySelector('dialog h2').textContent, /Innstillinger/); w.close();
});

const diagramPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
function diagramContext(w, state = () => ({vertices:[[0,0],[3,0],[3,4]]})) {
  w.TextEncoder = TextEncoder;
  const frame = w.document.createElement('iframe'); frame.id = 'triangle'; w.document.body.append(frame);
  frame.contentWindow.postMessage = request => {
    const reply = {...request, type:'response', payload:state(), ai:{image:diagramPng, summary:'Triangle ABC'}};
    // Unrelated frames and stale requests must not satisfy the collection.
    w.dispatchEvent(new w.MessageEvent('message', {source:w, data:{...reply,payload:'FORGED'}}));
    w.dispatchEvent(new w.MessageEvent('message', {source:frame.contentWindow, data:{...reply,requestId:'old',payload:'STALE'}}));
    w.dispatchEvent(new w.MessageEvent('message', {source:frame.contentWindow, data:reply}));
  };
  return frame;
}
test('visual contexts reach the actual request as context while the typed response is preserved', async () => {
  const {F,w} = page('<div id="lesson" class="ai-context">Use the labelled triangle.</div><button>Feedback</button><div id="out"></div>');
  diagramContext(w);
  let sent;
  const request = {profile:'mathematics', task:'Find the sloping side.', responses:[{id:'answer',value:'4'}],
    materials:F.contextMaterials({mode:'explicit',refs:'lesson, jsxgraph:triangle'})};
  const api = F.attach({contextRefs:'lesson, jsxgraph:triangle, jsxgraph:triangle',
    button:w.document.querySelector('button'), output:w.document.querySelector('#out'), getRequest:()=>request,
    client:{request:async r=>{sent=F.normalizeRequest(r); return {text:'Try again.',format:'markdown'};}}});
  await api.request();
  assert.equal(sent.responses[0].value,'4');
  assert.equal(sent.materials.length,2); assert.match(sent.materials[1].text,/vertices/);
  assert.doesNotMatch(JSON.stringify(sent),/FORGED|STALE/);
  assert.equal(sent.attachments.length,1); assert.equal(sent.attachments[0].role,'context');
  assert.equal(F.buildMessages(sent)[1].content.filter(p=>p.type==='image_url').length,1);
  const policy = F.buildMessages(F.applyPolicy('math-exercise', sent, 1))[0].content;
  assert.match(policy, /a context image illustrates the task/);
  assert.doesNotMatch(policy, /An attached image is the student/);
  api.dispose(); w.close();
});
test('copy prompts expose the diagram image for attachment in chat', async () => {
  const {F,w} = page('<button>Feedback</button><div id="out"></div>'); diagramContext(w);
  F.saveConfig({mode:'copy',storage:'session'});
  const api = F.attach({contextRefs:'jsxgraph:triangle', button:w.document.querySelector('button'),output:w.document.querySelector('#out'),
    getRequest:()=>({task:'Find the side.',responses:[{id:'answer',value:'4'}]})});
  await api.request();
  assert.equal(w.document.querySelector('.ai-feedback-images img').src,diagramPng);
  assert.match(w.document.querySelector('a[download]').download,/diagram-triangle\.png$/);
  assert.match(w.document.querySelector('pre').textContent,/vertices/);
  api.dispose(); w.close();
});
test('changing diagram state during a provider request discards obsolete feedback', async () => {
  const {F,w} = page('<button>Feedback</button><div id="out"></div>');
  let length=3, finish, ready; const started=new Promise(r=>{ready=r;}); diagramContext(w,()=>({length}));
  const api=F.attach({contextRefs:'jsxgraph:triangle',button:w.document.querySelector('button'),output:w.document.querySelector('#out'),
    getRequest:()=>({task:'Find the side.',responses:[{id:'answer',value:'4'}]}),
    client:{request:()=>new Promise(r=>{finish=r;ready();})}});
  const pending=api.request(); await started; length=6; finish({text:'OBSOLETE',format:'markdown'}); await pending;
  assert.doesNotMatch(w.document.querySelector('#out').textContent,/OBSOLETE/);
  assert.match(w.document.querySelector('#out').textContent,/changed/);
  api.dispose(); w.close();
});
test('missing boards and oversized context state fail visibly instead of silently dropping the diagram', async () => {
  const {F,w}=page();
  await assert.rejects(F.collectVisualContexts('jsxgraph:missing'),/iframe not found/);
  diagramContext(w,()=>({value:'x'.repeat(1024*1024)}));
  await assert.rejects(F.collectVisualContexts('jsxgraph:triangle'),/exceeds 1 MiB/);
  w.close();
});
test('policy summary uses the same runtime defaults and per-step limits as feedback', () => {
  const {w,F}=page('<div class="ai-feedback-policy-summary" data-integration="pyodide-interaktiv"></div><div class="ai-feedback-policy-summary" data-integration="plain-text" data-max-issues="7"></div>');
  w.qpyodideFeedbackOptions={hints:false};F.renderPolicySummaries();
  const [python,text]=w.document.querySelectorAll('.ai-feedback-policy-summary');
  const request=F.applyPolicy('pyodide-interaktiv',{task:'Review code',feedback:{language:'en'}},1,{steps:[]});
  assert.equal(request.feedback.mode,'review');assert.match(python.textContent,/Review without a hint sequence/);
  const plain=F.applyPolicy('plain-text',{task:'Review text',feedback:{maxIssues:7}},1,{});
  assert.equal(text.querySelectorAll('td')[2].textContent,String(plain.feedback.maxIssues));w.close();
});

test('feedback math loads the page\'s pinned KaTeX through CTMAssets, local in an offline build', async () => {
  const {F, w} = page('<div class="body"><span class="ai-feedback-math" data-tex="x^2"></span></div>');
  const requested = [];
  w.CTMAssets = {url: (name, file) => { requested.push([name, file]); return 'https://example.invalid/_ctm-assets/npm/katex@0.16.47/' + file; }};
  try {
    await F.typesetFeedback(w.document.querySelector('.body')).catch(() => {});  // jsdom cannot import the module
    assert.deepEqual(requested, [['katex', '']]);
    const sheets = [...w.document.querySelectorAll('link[rel="stylesheet"]')].map(link => link.href);
    assert.deepEqual(sheets, ['https://example.invalid/_ctm-assets/npm/katex@0.16.47/dist/katex.min.css']);
    assert.doesNotMatch(w.document.documentElement.outerHTML, /jsdelivr/);
  } finally { w.close(); }
});

test('feedback math without CTM assets keeps the KaTeX release line', async () => {
  const {F, w} = page('<div class="body"><span class="ai-feedback-math" data-tex="x^2"></span></div>');
  try {
    await F.typesetFeedback(w.document.querySelector('.body')).catch(() => {});
    assert.deepEqual([...w.document.querySelectorAll('link[rel="stylesheet"]')].map(link => link.href),
      ['https://cdn.jsdelivr.net/npm/katex@0.16/dist/katex.min.css']);
  } finally { w.close(); }
});

test('a migrated legacy config, API key included, is removed from both storages when the settings are saved', () => {
  const {F, w} = page();
  w.localStorage.setItem('math-exercise-llm-config', JSON.stringify({baseUrl: 'https://old.invalid', apiKey: 'sk-LEGACY-SECRET'}));
  w.sessionStorage.setItem('math-exercise-llm-config', JSON.stringify({baseUrl: 'https://old.invalid', apiKey: 'sk-LEGACY-SECRET'}));
  w.localStorage.setItem('qpyodide-feedback-config', JSON.stringify({baseUrl: 'https://other.invalid'}));
  try {
    const dialog = F.buildSettings();
    const buttons = [...dialog.querySelectorAll('button')];
    buttons.find(b => /math-exercise/.test(b.textContent)).click();
    const storage = [...dialog.querySelectorAll('select')].find(s => [...s.options].some(o => o.value === 'session') && [...s.options].some(o => o.value === 'local'));
    storage.value = 'session';
    buttons.find(b => b.textContent === 'Save settings').click();
    assert.equal(JSON.parse(w.sessionStorage.getItem('ai-feedback-config-v1')).apiKey, 'sk-LEGACY-SECRET');
    assert.equal(w.localStorage.getItem('ai-feedback-config-v1'), null);
    assert.equal(w.localStorage.getItem('math-exercise-llm-config'), null);
    assert.equal(w.sessionStorage.getItem('math-exercise-llm-config'), null);
    // A record that was not migrated stays importable.
    assert.notEqual(w.localStorage.getItem('qpyodide-feedback-config'), null);
  } finally { w.close(); }
});

test('saving settings without migrating keeps the legacy records importable', () => {
  const {F, w} = page();
  w.localStorage.setItem('math-exercise-llm-config', JSON.stringify({baseUrl: 'https://old.invalid'}));
  try {
    const dialog = F.buildSettings();
    [...dialog.querySelectorAll('button')].find(b => b.textContent === 'Save settings').click();
    assert.notEqual(w.localStorage.getItem('math-exercise-llm-config'), null);
  } finally { w.close(); }
});
