// ctm.checkers (lua/checkers.lua, step-2 design §3.5): the ctm-checkers
// installation next to ctm-libs (the package) or in the project
// (`quarto add` of a ctm-checkers checkout), its manifest, wheel and build-time
// environment, the API check, and the page script as the HTML dependency
// "ctm-checkers". A development version's dependency path holds a `+`
// (site_libs/quarto-contrib/ctm-checkers-X.Y.Z.devN+<sha8>/): the script is
// served from it. Uses the ctm-checkers commit in tests/pins.json
// (CTM_CHECKERS_SOURCE, default _ctm-checkers-source).
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), http = require('node:http'), path = require('node:path');
const {spawnSync} = require('node:child_process');
const C = require('./helpers/ctm-libs.cjs');

const source = path.resolve(C.repository, process.env.CTM_CHECKERS_SOURCE || '_ctm-checkers-source');
const folder = path.join(source, '_extensions', 'ctm-checkers');
const haveCheckers = fs.existsSync(path.join(folder, 'checkers.json'));
const skip = !C.hasQuarto ? 'Quarto required'
  : haveCheckers || process.env.CI ? false : 'needs ctm-checkers (tests/pins.json) in _ctm-checkers-source or CTM_CHECKERS_SOURCE';
const INSTALL = 'quarto add https://erasmus-ctm.github.io/ctm-assessment/ctm-assessment.tar.gz';

async function withProject(setup, files, run) {
  assert.ok(haveCheckers, 'ctm-checkers is missing: check out the commit of tests/pins.json into ' + source);
  const dir = fs.realpathSync(C.tempdir('ctm-checkers-'));
  try {
    C.install(dir); C.installProbe(dir);
    setup(dir);
    C.write(dir, files);
    return await run(dir);
  } finally { fs.rmSync(dir, {recursive: true, force: true}); }
}
const manifest = () => JSON.parse(fs.readFileSync(path.join(folder, 'checkers.json'), 'utf8'));
const page = (...probes) => '---\ntitle: t\n---\n' + probes.join('');

// Serves `root` as a static host does (percent-escapes decoded, `+` kept) and fetches `url`.
async function fetchFrom(root, url) {
  const server = http.createServer((request, response) => {
    const file = path.join(root, decodeURIComponent(new URL(request.url, 'http://host').pathname));
    if (!file.startsWith(root) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { response.writeHead(404); response.end(); return; }
    response.writeHead(200); response.end(fs.readFileSync(file));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const response = await fetch(new URL(url, `http://127.0.0.1:${server.address().port}/`));
    return {status: response.status, body: Buffer.from(await response.arrayBuffer())};
  } finally { server.close(); }
}

test('the package layout: manifest, wheel, environment, API check and the page script under its dependency version', {skip}, async () => {
  const expected = manifest();
  await withProject((dir) => {
    C.installPackage(dir);
    fs.cpSync(folder, path.join(dir, '_extensions', 'ctm-checkers'), {recursive: true});
  }, {
    '_quarto.yml': 'project:\n  type: website\n  render: [index.qmd]\nfilters: [ctm-libs, probe]\n',
    'index.qmd': page(
      C.probe('required', 'return ctm.checkers.require("probe", 1)'),
      C.probe('minor', 'return ctm.checkers.require("probe", "1.0").version'),
      C.probe('currentApi', 'return ctm.checkers.require("probe", ' + JSON.stringify(String(expected.api)) + ').version'),
      C.probe('folder', 'return ctm.checkers.folder()'),
      C.probe('wheel', 'return ctm.checkers.wheel()'),
      C.probe('environment', 'local e = ctm.checkers.environment({PYTHONPATH = "/site-packages", HOME = "/home/author"})\n'
        + 'return {PYTHONPATH = e.PYTHONPATH, CTM_CHECKERS_WHEEL = e.CTM_CHECKERS_WHEEL, HOME = e.HOME}'),
      C.probe('fresh', 'local e = ctm.checkers.environment({})\nreturn {PYTHONPATH = e.PYTHONPATH}'),
      C.probe('use', 'ctm.checkers.use()\nreturn true')),
  }, async (dir) => {
    const r = C.render(dir);
    assert.equal(r.status, 0, r.stderr);
    const html = C.html(path.join(dir, '_site'), 'index.qmd');
    const p = C.probes(html);
    const installed = path.join(dir, '_extensions', 'ctm-checkers');
    const wheel = path.join(installed, expected.wheel);
    assert.deepEqual(p.required, expected);
    assert.equal(p.minor, expected.version);
    assert.equal(p.currentApi, expected.version);
    assert.equal(p.folder, installed);
    assert.equal(p.wheel, wheel);
    assert.deepEqual(p.environment, {PYTHONPATH: wheel + ':/site-packages', CTM_CHECKERS_WHEEL: wheel, HOME: '/home/author'});
    assert.deepEqual(p.fresh, {PYTHONPATH: wheel});
    // The script, under site_libs/quarto-contrib/ctm-checkers-<dependency>/ (a `+` in a development version's).
    const libs = path.join(dir, '_site', 'site_libs', 'quarto-contrib', 'ctm-checkers-' + expected.dependency);
    assert.ok(fs.existsSync(path.join(libs, expected.script)), fs.readdirSync(path.join(dir, '_site', 'site_libs', 'quarto-contrib')).join(', '));
    if (expected.version.includes('.dev')) assert.match(expected.dependency, /\+[0-9a-f]{8}$/);
    const tags = [...html.matchAll(/<script src="([^"]*ctm-checkers[^"]*)"/g)].map((match) => match[1]);
    assert.equal(tags.length, 1, html);
    const fetched = await fetchFrom(path.join(dir, '_site'), new URL(tags[0], 'http://host/index.html').pathname);
    assert.equal(fetched.status, 200, tags[0]);
    assert.ok(fetched.body.equals(fs.readFileSync(path.join(folder, expected.script))), 'the served script is ctm-checkers.js');
    // In the head, before the components' scripts that use it.
    assert.ok(html.indexOf(tags[0]) < html.indexOf('</head>'));
  });
});

test('the STACK engine\'s part: its wheel after the first on PYTHONPATH and its page script after ctm-checkers.js', {skip}, async () => {
  const expected = manifest();
  const stack = expected.parts && expected.parts.stack;
  assert.ok(stack, 'ctm-checkers 0.2 or later (tests/pins.json) has parts.stack');
  await withProject((dir) => {
    C.installPackage(dir);
    fs.cpSync(folder, path.join(dir, '_extensions', 'ctm-checkers'), {recursive: true});
  }, {
    '_quarto.yml': 'project:\n  type: website\n  render: [index.qmd, math.qmd]\nfilters: [ctm-libs, probe]\n',
    'index.qmd': page(
      C.probe('wheel', 'return ctm.checkers.wheel("stack")'),
      C.probe('environment', 'local e = ctm.checkers.environment({PYTHONPATH = "/site-packages"}, "stack")\n'
        + 'return {PYTHONPATH = e.PYTHONPATH, CTM_CHECKERS_WHEEL = e.CTM_CHECKERS_WHEEL}'),
      C.probe('use', 'ctm.checkers.use("stack")\nreturn true')),
    'math.qmd': page(C.probe('use', 'ctm.checkers.use()\nreturn true')),
  }, async (dir) => {
    const r = C.render(dir);
    assert.equal(r.status, 0, r.stderr);
    const installed = path.join(dir, '_extensions', 'ctm-checkers');
    const html = C.html(path.join(dir, '_site'), 'index.qmd');
    const p = C.probes(html);
    assert.equal(p.wheel, path.join(installed, stack.wheel));
    assert.deepEqual(p.environment, {PYTHONPATH: path.join(installed, expected.wheel) + ':' + path.join(installed, stack.wheel) + ':/site-packages',
      CTM_CHECKERS_WHEEL: path.join(installed, expected.wheel)});
    const tags = [...html.matchAll(/<script src="([^"]*ctm-checkers[^"]*)"/g)].map((match) => match[1]);
    assert.deepEqual(tags.map((tag) => tag.split('/').slice(-2).join('/')),
      ['ctm-checkers-' + expected.dependency + '/' + expected.script, 'ctm-checkers-stack-' + stack.dependency + '/' + stack.script]);
    const fetched = await fetchFrom(path.join(dir, '_site'), new URL(tags[1], 'http://host/index.html').pathname);
    assert.equal(fetched.status, 200, tags[1]);
    assert.ok(fetched.body.equals(fs.readFileSync(path.join(folder, stack.script))));
    // A page that uses ctm-checkers alone (math-exercise) carries no STACK engine.
    const math = C.html(path.join(dir, '_site'), 'math.qmd');
    assert.equal([...math.matchAll(/<script src="([^"]*ctm-checkers[^"]*)"/g)].length, 1);
    assert.ok(!math.includes('ctm-checkers-stack'));
  });
  // A part this ctm-checkers does not have stops the render with the update command.
  await withProject((dir) => fs.cpSync(folder, path.join(dir, '_extensions', 'ctm-checkers'), {recursive: true}), {
    '_quarto.yml': 'project:\n  type: default\n  render: [page.qmd]\nfilters: [ctm-libs, probe]\n',
    'page.qmd': page(C.probe('use', 'ctm.checkers.use("nothing")\nreturn true')),
  }, (dir) => {
    const r = C.render(dir, [], {CTM_COMPONENT_DEV: '1'});
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, new RegExp('has no nothing part \\(it comes with ctm-checkers 0\\.2\\)\\. Update CTM Assessment: ' + INSTALL.replace(/[.]/g, '\\.')));
  });
});

test('quarto add of a ctm-checkers checkout: the project\'s installation is found', {skip}, () => withProject((dir) => {
  const added = spawnSync(C.quarto, ['add', source, '--no-prompt'], {cwd: dir, encoding: 'utf8', timeout: 240000});
  assert.equal(added.status, 0, added.stderr);
}, {
  '_quarto.yml': 'project:\n  type: default\n  render: [page.qmd]\nfilters: [ctm-libs, probe]\n',
  'page.qmd': page(C.probe('folder', 'return ctm.checkers.folder()'), C.probe('version', 'return ctm.checkers.require("probe", 1).version')),
}, (dir) => {
  const r = C.render(dir, [], {CTM_COMPONENT_DEV: '1'});
  assert.equal(r.status, 0, r.stderr);
  const p = C.probes(C.html(dir, 'page.qmd'));
  assert.equal(p.folder, path.join(dir, '_extensions', 'ctm-checkers'));
  assert.equal(p.version, manifest().version);
}));

test('without ctm-checkers, or with another API level, the render stops with the command to run', {skip}, async () => {
  await withProject(() => {}, {
    '_quarto.yml': 'project:\n  type: default\n  render: [page.qmd]\nfilters: [ctm-libs, probe]\n',
    'page.qmd': page(C.probe('required', 'return ctm.checkers.require("probe", 1)')),
  }, (dir) => {
    const r = C.render(dir, [], {CTM_COMPONENT_DEV: '1'});
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, new RegExp('probe needs ctm-checkers, the checker library of CTM Assessment, which is not installed in this project\\. '
      + 'Install CTM Assessment: ' + INSTALL.replace(/[.]/g, '\\.')));
  });
  const [major, minor = 0] = String(manifest().api).split('.').map(Number);
  for (const api of [String(major + 1), JSON.stringify(major + '.' + (minor + 1))]) {
    await withProject((dir) => fs.cpSync(folder, path.join(dir, '_extensions', 'ctm-checkers'), {recursive: true}), {
      '_quarto.yml': 'project:\n  type: default\n  render: [page.qmd]\nfilters: [ctm-libs, probe]\n',
      'page.qmd': page(C.probe('required', 'return ctm.checkers.require("probe", ' + api + ')')),
    }, (dir) => {
      const r = C.render(dir, [], {CTM_COMPONENT_DEV: '1'});
      assert.notEqual(r.status, 0);
      assert.match(r.stderr, new RegExp('probe needs ctm-checkers API ' + api.replace(/"/g, '').replace('.', '\\.') + '; .*ctm-checkers has ctm-checkers '
        + manifest().version.replace(/\./g, '\\.') + ' \\(API ' + String(manifest().api).replace(/\./g, '\\.')
        + '\\)\\. Update CTM Assessment: ' + INSTALL.replace(/[.]/g, '\\.')));
    });
  }
});
