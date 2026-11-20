// One CTM installation per page. Two ctm-libs installations of different
// versions or files stop the page (ctm.lua), and so does an older ai-feedback (0.8)
// whose loader registered itself before ctm-libs (legacy registration).
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const C = require('./helpers/ctm-libs.cjs');
const skip = C.hasQuarto ? false : 'Quarto required';

function project(otherVersion) {
  const dir = C.tempdir('feedback-mix-');
  C.install(dir);
  // A second ctm-libs installation under an owner folder.
  const other = C.install(dir, {owner: 'other'});
  C.setVersion(path.join(other, 'ctm-libs'), otherVersion);
  // A second filter that loads the other installation, as an older component's loader would.
  C.write(dir, {
    'consumer.lua': 'local api = dofile(pandoc.path.join({pandoc.path.directory(PANDOC_SCRIPT_FILE), "_extensions", "other", "ctm-libs", "lua", "ctm.lua"}))\nreturn {}\n',
    'page.qmd': '---\ntitle: t\nfilters: [ctm-libs, consumer.lua]\n---\n\n::: {.ai-feedback}\nWrite.\n:::\n',
  });
  return dir;
}

test('the ctm-libs filter and another installation with a different version stop the page', {skip}, () => {
  const dir = project('9.9.9');
  try {
    const r = C.render(dir, ['page.qmd']);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /This page combines two CTM installations: .*\(0\.9\.0\) and .*other.ctm-libs \(9\.9\.9\)/s);
  } finally { fs.rmSync(dir, {recursive: true, force: true}); }
});

test('the same version and files from two installations renders', {skip}, () => {
  const dir = project(C.version());
  try {
    const r = C.render(dir, ['page.qmd']);
    assert.equal(r.status, 0, r.stderr);
  } finally { fs.rmSync(dir, {recursive: true, force: true}); }
});

test('the same version with different files stops the page (B1)', {skip}, () => {
  const dir = project(C.version());
  try {
    const settings = path.join(dir, '_extensions', 'other', 'ctm-libs', 'lua', 'settings.lua');
    fs.appendFileSync(settings, '\n-- an edited copy\n');
    const r = C.render(dir, ['page.qmd']);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /This page combines two CTM installations: .*\(0\.9\.0\) and .*other.ctm-libs \(0\.9\.0, with different files\)/s);
  } finally { fs.rmSync(dir, {recursive: true, force: true}); }
});

test('the same version with a different file outside lua/ stops the page (B1)', {skip}, () => {
  for (const file of [['runtime', 'pyodide-worker.js'], ['feedback', 'feedback-core.js'], ['read-settings.ts']]) {
    const dir = project(C.version());
    try {
      fs.appendFileSync(path.join(dir, '_extensions', 'other', 'ctm-libs', ...file), '\n// an edited copy\n');
      const r = C.render(dir, ['page.qmd']);
      assert.notEqual(r.status, 0, file.join('/'));
      assert.match(r.stderr, /This page combines two CTM installations: .*other.ctm-libs \(0\.9\.0, with different files\)/s, file.join('/'));
    } finally { fs.rmSync(dir, {recursive: true, force: true}); }
  }
});

test('copies that differ only by dotfiles, empty folders or CRLF line endings render (B1)', {skip}, () => {
  const crlf = file => fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(/\n/g, '\r\n'));
  const edits = {
    '.DS_Store': other => { fs.writeFileSync(path.join(other, 'lua', '.DS_Store'), 'x'); fs.writeFileSync(path.join(other, '.DS_Store'), 'x'); },
    'a dot folder': other => C.write(other, {'.git/HEAD': 'ref: refs/heads/main\n'}),
    'an empty subfolder': other => { fs.mkdirSync(path.join(other, 'lua', 'old')); fs.mkdirSync(path.join(other, 'runtime', 'old', 'older'), {recursive: true}); },
    'CRLF': other => { crlf(path.join(other, 'lua', 'ui.lua')); crlf(path.join(other, 'runtime', 'pyodide-worker.js')); },
  };
  for (const [name, edit] of Object.entries(edits)) {
    const dir = project(C.version());
    try {
      edit(path.join(dir, '_extensions', 'other', 'ctm-libs'));
      const r = C.render(dir, ['page.qmd']);
      assert.equal(r.status, 0, name + ': ' + r.stderr);
    } finally { fs.rmSync(dir, {recursive: true, force: true}); }
  }
});

test('an ai-feedback 0.8 registered on the page before ctm-libs stops it with the migration message', {skip}, () => {
  const dir = C.tempdir('feedback-mix-');
  try {
    C.install(dir);
    // What ai-feedback 0.8.1's feedback-quarto.lua registers when its filter loads first.
    C.write(dir, {
      'old.lua': '_G.__ctmAiFeedbackInstallation = {path = "/old/_extensions/Erasmus-CTM/ai-feedback/feedback-quarto.lua", version = "0.8.1"}\nreturn {}\n',
      'page.qmd': '---\ntitle: t\nfilters: [old.lua, ctm-libs]\n---\n\n::: {.ai-feedback}\nWrite.\n:::\n',
    });
    const r = C.render(dir, ['page.qmd']);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /This page combines filters that use different ai-feedback versions: \/old\/.* \(0\.8\.1\) and .*ctm-libs.lua.feedback\.lua \(0\.9\.0\)\. AI feedback is part of CTM Assessment and of pyodide-interaktiv 1\.9: remove ai-feedback from filters: and delete the old folder\./s);
  } finally { fs.rmSync(dir, {recursive: true, force: true}); }
});
