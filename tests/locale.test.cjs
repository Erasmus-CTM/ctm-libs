// The help table's input examples deliberately correct the legacy LaTeX leak.
// The message catalogues and their browser resolver (locales/ctm-locale.js):
// the compiled tables give byte-identical texts to math-exercise 0.9 and
// py-exercise 0.3 for every key, language and sample argument (goldens from
// scripts/capture-legacy-locales.mjs), and to pyodide-interaktiv 1.8 (goldens
// committed as data, goldens/pyodide-interaktiv-locales.json), and the
// resolver's language chains.
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const {spawnSync} = require('node:child_process');
const C = require('./helpers/ctm-libs.cjs');
const golden = require('./goldens/legacy-locales.json');
const pyodideGolden = require('./goldens/pyodide-interaktiv-locales.json');

const locales = path.join(C.library, 'locales');
// Values from the vm context have that context's prototypes.
const plain = value => JSON.parse(JSON.stringify(value));
function runtime(files = ['common.js', 'math-exercise.js', 'py-exercise.js', 'feedback.js'], extra = {}) {
  const warnings = [];
  const context = vm.createContext({console: {warn: message => warnings.push(message)}, ...extra});
  for (const file of ['ctm-locale.js', ...files]) vm.runInContext(fs.readFileSync(path.join(locales, file), 'utf8'), context, {filename: file});
  return {L: context.CTMLocales, context, warnings};
}

for (const [namespace, languages] of [['math-exercise', ['en', 'de', 'nb']], ['py-exercise', ['en', 'de']]]) {
  test(namespace + ': every legacy text is reproduced byte for byte', () => {
    const {L, warnings} = runtime();
    for (const lang of languages) {
      const table = L.table(namespace, lang), old = golden[namespace].js[lang];
      for (const [key, value] of Object.entries(old)) {
        if (value && value.$calls) {
          assert.equal(typeof table[key], 'function', lang + '.' + key);
          for (const [args, output] of value.$calls) assert.equal(table[key](...args), output, lang + '.' + key + '(' + JSON.stringify(args).slice(1, -1) + ')');
        } else {
          let expected = plain(value);
          // P13: a graceful Stop need not restart; the reset notice is separate.
          if ((namespace === 'math-exercise' && key === 'errStopped') || (namespace === 'py-exercise' && key === 'stopped')) {
            expected = {en:'Stopped.',de:'Abgebrochen.',nb:'Avbrutt.'}[lang];
          }
          // Keep the historical golden unchanged; input examples are plain CAS syntax.
          if (namespace === 'math-exercise' && key === 'legend') expected[0][1] =
            'x^2 ' + {en:'or',de:'oder',nb:'eller'}[lang] + ' x**2';
          assert.deepEqual(plain(table[key]), expected, lang + '.' + key);
        }
      }
    }
    assert.deepEqual(warnings, []);
  });
}

test('pyodide-interaktiv: every text of 1.8 is reproduced byte for byte (no and nb are Bokmål)', () => {
  const {L, warnings} = runtime(['common.js', 'pyodide-interaktiv.js']);
  assert.deepEqual(plain(L.languages('pyodide-interaktiv')), ['en', 'de', 'sv', 'nb', 'da']);
  assert.deepEqual(Object.keys(pyodideGolden.js).sort(), ['da', 'de', 'en', 'nb', 'no', 'sv']);
  for (const [lang, old] of Object.entries(pyodideGolden.js)) {
    const table = L.table('pyodide-interaktiv', lang);
    // The catalogue adds noscript (from qpyodide.lua) and stage 2's two texts (D2).
    assert.deepEqual(Object.keys(table).filter(key => !(key in old)).sort(), ['noscript', 'setupFailed', 'setupRetry'], lang);
    for (const [key, value] of Object.entries(old)) {
      if (value && value.$calls) {
        assert.equal(typeof table[key], 'function', lang + '.' + key);
        for (const [args, output] of value.$calls) assert.equal(table[key](...args), output, lang + '.' + key + '(' + JSON.stringify(args).slice(1, -1) + ')');
      } else {
        assert.equal(table[key], value, lang + '.' + key);
      }
    }
  }
  for (const [lang, text] of Object.entries(pyodideGolden.lua.noscriptMessages)) assert.equal(L.t('pyodide-interaktiv', 'noscript', lang), text, lang);
  // Stage 2's failure: the effect, the package once, and that other code is unaffected,
  // in the catalogue's own words for it (inputPanelUnavailable: "works normally").
  const failed = {
    en: '🟠 Plots are not available: some packages could not be loaded (matplotlib: HTTP 404). Other Python code works normally.',
    de: '🟠 Plots sind nicht verfügbar: Einige Pakete konnten nicht geladen werden (matplotlib: HTTP 404). Anderer Python-Code läuft normal.',
    sv: '🟠 Grafer är inte tillgängliga: några paket kunde inte laddas (matplotlib: HTTP 404). Annan Python-kod fungerar som vanligt.',
    nb: '🟠 Grafer er ikke tilgjengelige: noen pakker kunne ikke lastes inn (matplotlib: HTTP 404). Annen Python-kode virker som normalt.',
    da: '🟠 Grafer er ikke tilgængelige: nogle pakker kunne ikke indlæses (matplotlib: HTTP 404). Anden Python-kode virker som normalt.',
  };
  for (const [lang, text] of Object.entries(failed)) assert.equal(L.t('pyodide-interaktiv', 'setupFailed', lang, 'matplotlib: HTTP 404'), text, lang);
  // nn shows Bokmål until the catalogue has Nynorsk (step 4); other languages English.
  assert.equal(L.resolve('pyodide-interaktiv', 'nn'), 'nb');
  assert.equal(L.resolve('pyodide-interaktiv', 'no'), 'nb');
  assert.equal(L.resolve('pyodide-interaktiv', 'de-CH'), 'de');
  assert.equal(L.resolve('pyodide-interaktiv', 'sv-FI'), 'sv');
  assert.equal(L.resolve('pyodide-interaktiv', 'fr'), 'en');
  assert.deepEqual(warnings, []);
});

test('the Lua-rendered labels moved into the catalogues unchanged', () => {
  const {L} = runtime();
  const names = {check: 'checkButton', legend: 'legendButton', feedback: 'feedbackButton', reconfig: 'reconfigTitle', poolReload: 'poolReloadTitle'};
  for (const [lang, labels] of Object.entries(golden['math-exercise'].lua.uiText)) {
    for (const [old, key] of Object.entries(names)) assert.equal(L.t('math-exercise', key, lang), labels[old], lang + '.' + key);
  }
  for (const [lang, text] of Object.entries(golden['py-exercise'].lua.noscriptMessages)) assert.equal(L.t('py-exercise', 'noscript', lang), text);
});

test('Stop, stopped and loading texts are one shared set (common)', () => {
  const {L} = runtime();
  for (const lang of ['en', 'de', 'nb']) {
    for (const [key, shared] of [['stop', 'stop'], ['slowLoad', 'slowLoad'], ['errStopped', 'stopped']]) assert.equal(L.t('math-exercise', key, lang), L.t('common', shared, lang));
    for (const key of ['stop', 'slowLoad', 'stopped']) assert.equal(L.t('py-exercise', key, lang), L.t('common', key, lang));
  }
});

test('py-exercise speaks Bokmål: every key, functions included', () => {
  const {L, warnings} = runtime();
  const table = L.table('py-exercise', 'nb');
  assert.deepEqual(plain(Object.keys(table)), plain(Object.keys(L.table('py-exercise', 'en'))));
  assert.match(table.btnCheck, /Sjekk$/);
  assert.equal(table.stop, 'Avbryt');
  assert.equal(table.allPassed(1), '✅ Testen er bestått!');
  assert.equal(table.allPassed(3), '✅ Alle 3 testene er bestått!');
  assert.equal(table.someFailed(1, 4), '❌ 1 av 4 tester bestått');
  assert.equal(table.msgForbiddenImport, "Forbudt import: '{}'");
  assert.deepEqual(warnings, []);
});

test('language chains: region subtags, no and nn, unknown languages', () => {
  const {L} = runtime();
  assert.deepEqual(plain(L.chain('nb-NO')), ['nb', 'en']);
  assert.deepEqual(plain(L.chain('no')), ['nb', 'en']);
  assert.deepEqual(plain(L.chain('nn')), ['nn', 'nb', 'en']);
  assert.deepEqual(plain(L.chain('de-CH')), ['de', 'en']);
  assert.deepEqual(plain(L.chain('sv')), ['sv', 'en']);
  assert.deepEqual(plain(L.chain('EN_gb')), ['en']);
  assert.deepEqual(plain(L.chain('')), ['en']);
  assert.equal(L.normalize('NB_no'), 'nb');
  assert.equal(L.resolve('py-exercise', 'nn'), 'nb');
  assert.equal(L.resolve('math-exercise', 'de-AT'), 'de');
  assert.equal(L.resolve('math-exercise', 'sv'), 'en');
  assert.equal(L.resolve('feedback', 'es-MX'), 'es');
  assert.equal(L.resolve('math-exercise', 'es'), 'en');
  assert.equal(L.table('math-exercise', 'nn').checkButton, 'Sjekk');
});

test('a key a language lacks falls back to English with one console warning; $lookup, plurals and $ref', () => {
  const {L, warnings} = runtime(['common.js']);
  L.add('demo', {$languages: ['en', 'de'],
    en: {hello: 'Hello', count: {$args: ['n'], $plural: 'n', one: '{n} item', other: '{n} items'}, kind: {$t: 'A {k} one', $args: ['k'], $lookup: {k: 'kinds'}},
      kinds: {big: 'big', '*': 'plain'}, stop: {$ref: 'common.stop'}, raw: "Keep {} and {other}"},
    de: {count: {$args: ['n'], $plural: 'n', one: '{n} Ding', other: '{n} Dinge'}, kind: {$t: 'Ein {k}', $args: ['k'], $lookup: {k: 'kinds'}}, kinds: {big: 'großes', '*': 'einfaches'}, stop: {$ref: 'common.stop'}, raw: 'Behalte {}'}});
  const de = L.table('demo', 'de');
  assert.equal(de.hello, 'Hello');
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /demo has no de text for hello; using English/);
  assert.equal(de.count(1), '1 Ding');
  assert.equal(de.count(2), '2 Dinge');
  assert.equal(de.count('1'), '1 Dinge');
  assert.equal(de.kind('big'), 'Ein großes');
  assert.equal(de.kind('other'), 'Ein einfaches');
  assert.equal(de.kind(), 'Ein einfaches');
  assert.equal(de.stop, 'Abbrechen');
  assert.equal(L.t('demo', 'raw', 'en'), 'Keep {} and {other}');
  L.table('demo', 'de');
  assert.equal(warnings.length, 1, 'tables are compiled once');
});

test('the feedback interface strings in ai-feedback.js are generated from the catalogue', () => {
  const {L} = runtime();
  const {JSDOM} = require('jsdom');
  const w = new JSDOM('<main></main>', {url: 'https://example.invalid/', runScripts: 'outside-only'}).window;
  for (const file of ['feedback-core.js', 'feedback-dom.js', 'ai-feedback.js']) w.eval(fs.readFileSync(path.join(C.feedback, file), 'utf8'));
  const shipped = JSON.parse(JSON.stringify(w.AIFeedback.locales));
  assert.deepEqual(Object.keys(shipped), plain(L.languages('feedback')));
  for (const lang of L.languages('feedback')) assert.deepEqual(shipped[lang], plain(L.table('feedback', lang)), lang);
  w.close();
});

test('check-locales.py accepts the catalogues and reports a broken one', {skip: spawnSync('python3', ['--version']).error ? 'Python required' : false}, () => {
  const script = path.join(C.repository, 'scripts', 'check-locales.py');
  let r = spawnSync('python3', [script], {encoding: 'utf8'});
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /py-exercise: en, de, nb/);
  // A copy of the repository's locales with mistakes.
  const dir = C.tempdir('ctm-locales-');
  try {
    const copy = path.join(dir, '_extensions', 'ctm-libs', 'locales');
    fs.cpSync(locales, copy, {recursive: true});
    fs.mkdirSync(path.join(dir, 'scripts'));
    fs.copyFileSync(script, path.join(dir, 'scripts', 'check-locales.py'));
    const file = path.join(copy, 'py-exercise.js');
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8')
      .replace('"stdoutLabel": "Utskrift:",\n', '')
      .replace('"one":"❌ {p} av {t} test bestått"', '"one":"❌ {p} av {total} test bestått"')
      .replace('"stop": {"$ref":"common.stop"},\n  "stopped"', '"stop": {"$ref":"common.halt"},\n  "stopped"'));
    r = spawnSync('python3', [path.join(dir, 'scripts', 'check-locales.py')], {encoding: 'utf8'});
    assert.equal(r.status, 1);
    assert.match(r.stderr, /py-exercise\.js: nb lacks stdoutLabel/);
    assert.match(r.stderr, /nb\.someFailed: \{total\} is not one of \$args/);
    assert.match(r.stderr, /\$ref to common\.halt, which does not exist/);
  } finally { fs.rmSync(dir, {recursive: true, force: true}); }
});

test('input-help power examples contain literal CAS syntax in every supported language', () => {
  const {L}=runtime();
  for(const lang of ['en','de','nb']) {
    const row=L.table('math-exercise',lang).legend[0];
    assert.equal(row[0],'x^2','the expression column retains its TeX');
    assert.match(row[1],/^x\^2 (or|oder|eller) x\*\*2$/);
    assert.doesNotMatch(row[1],/[\\{}]/,'input examples must not contain TeX commands or grouping');
  }
});
