# Development

[Start here](../README.md) · [API](api.md) · [Reference](reference.md)

## Layout

```
_extensions/ctm-libs/            the library (authors never list it; the package does)
  _extension.yml                 version of everything below
  ctm-libs.lua                   filter entry: ctm.filters() (Meta, Callout, the page's interface, Pandoc)
  ctm-libs-end.lua               listed by the package after every CTM filter: prints the page's P22 build message, or stops for without-ai
  read-settings.ts, deno.json    settings reader (quarto run), with its isolated Deno configuration
  lua/ctm.lua                    the page's instance; lazily loaded modules:
  lua/settings.lua               ctm.settings
  lua/locale.lua                 ctm.locale
  lua/feedback.lua, policy.lua   ctm.feedback (activities, context, policies, P22, without-ai)
  lua/runtime.lua, deps.lua      ctm.runtime, ctm.deps
  lua/checkers.lua               ctm.checkers: ctm-checkers (the checker library's folder, wheel, page script)
  lua/ui.lua                     ctm.ui: reveals, the lecture/reading switch, embedded pages, tab links, markdown-lint
  lua/sections.lua, source.lua   ctm.sections (headings, tabs, scopes), ctm.source (the page's Markdown, file:line)
  ui/                            ctm-ui.css, ctm-reveal.js (CTMReveal), ctm-nav.js (CTMNav)
  feedback/                      AIFeedback browser files, feedback-defaults.yml
  runtime/pyodide-runtime.js     MathExerciseRuntime
  locales/                       ctm-locale.js (CTMLocales) and the message catalogues
bootstrap/ctm-bootstrap.lua      the file every component copies
scripts/                         sync-feedback-defaults.py, sync-pyodide-sympy.py, check-locales.py, capture-legacy-locales.mjs
tests/                           npm test
```

## Tests

```sh
npm ci
npm test                                     # unit tests and Quarto render tests (Quarto 1.8.27 or later)
python -m pip install 'PyYAML>=6'
python scripts/sync-feedback-defaults.py --check
python scripts/check-locales.py
python scripts/sync-pyodide-sympy.py --check   # after npm ci: Pyodide's SymPy, runtime/pyodide-sympy.json
```

In VS Code, **Terminal → Run Task…** offers the same commands
(`.vscode/tasks.json`). The render tests build small projects in temporary
folders with this repository's extensions and a probe component
(`tests/fixtures/probe`) that loads ctm-libs through the canonical bootstrap
and evaluates Lua against it.

The ctm-checkers tests (`tests/checkers-*.test.cjs`: installs and calls in
Pyodide 0.28.3, the `pyodide` package of `package.json`; the render
fixture) use ctm-checkers at the commit in `tests/pins.json`, checked out
into `_ctm-checkers-source` (or `CTM_CHECKERS_SOURCE`); without it they are
skipped locally:

```sh
git clone https://github.com/Erasmus-CTM/ctm-checkers _ctm-checkers-source
git -C _ctm-checkers-source checkout <ctm-checkers commit in tests/pins.json>
```

They load SymPy into Pyodide from jsDelivr; `PYODIDE_PACKAGES=<folder>`
loads it from a folder with the wheels of Pyodide's lock file instead.

CI (`.github/workflows`):

- `test.yml`: the checks above, with ctm-checkers at the commit in
  `tests/pins.json` (a head commit's `CTM-Review-Refs` trailer can name
  another for review, read by the umbrella's
  `tools/ci/review-dependencies.py` at the pinned umbrella commit);
- `example.yml`: renders `example.qmd`;
- `browser.yml`: the runtime loads Pyodide from jsDelivr in Chromium; the
  page's interface (`tests/browser/ui.mjs`: links into tabs and reveals, the
  switch, printing) on a rendered site, in Chromium, Firefox and WebKit.
  Locally: `node tests/browser/ui.mjs chromium firefox webkit` (Quarto and
  Playwright's browsers; `CHROMIUM_PATH` selects a local Chromium).

The CTM Assessment umbrella runs `npm test` here as well, against the
package it builds.

## Generated files and versions

`python scripts/sync-feedback-defaults.py` regenerates

- the shipped policies in `feedback/feedback-core.js` from
  `feedback/feedback-defaults.yml`;
- the interface strings of `feedback/ai-feedback.js` from
  `locales/feedback.js` (that file stays self-contained: pyodide-interaktiv
  1.8's tests load the three feedback files without a locale runtime);
- the version, from `_extensions/ctm-libs/_extension.yml`, in the forwarder
  template manifest, the `VERSION` of `feedback-core.js`, `package.json` and
  `package-lock.json`.

`--check` fails when one of them differs. For a release, change the version
in `_extensions/ctm-libs/_extension.yml` and run the script. The forwarder
manifest keeps ctm-libs' version.

## Messages

Every interface text is in a catalogue, `locales/<namespace>.js`: valid
JavaScript (`CTMLocales.add("<namespace>", …)`) whose payload between
`/*BEGIN-JSON*/` and `/*END-JSON*/` is strict JSON. English is the reference;
every language listed in `$languages` has every key. Edit the JSON only,
then run `python scripts/check-locales.py` (format, completeness, `$ref`
targets, `$t` arguments, plurals; it prints the coverage). After editing
`locales/feedback.js`, run the sync script.

A component uses its namespace in Lua (`ctm.locale.text`) and in the browser
(`CTMLocales.table(namespace, lang)` after `ctm.locale.use(namespace)`).
A new language is added to `$languages` with all its texts.

`tests/goldens/legacy-locales.json` holds the texts of math-exercise 0.9 and
py-exercise 0.3, recorded once by `scripts/capture-legacy-locales.mjs`;
`tests/goldens/pyodide-interaktiv-locales.json` those of pyodide-interaktiv
1.8 (every key of en, de, sv, no/nb and da, and the noscript texts), kept as
data without a capture script. `tests/locale.test.cjs` keeps the catalogues
byte-identical to them.

## The component bootstrap

`bootstrap/ctm-bootstrap.lua` is copied byte for byte into every component
(the CTM Assessment build compares the copies; pyodide-interaktiv's CI
compares its generated copy with the ctm-libs commit it records). It holds
only the location logic: the package requirement (`CTM_COMPONENT_DEV=1` for
component development; `opts.standalone` for a component that also works
without the package), the search for ctm-libs, and the interface level
(`opts.api`, default `API`).

`ctm.api >= opts.api` only catches a ctm-libs that is too old for the
component (for example a separately installed copy next to a newer
component); `>=` means a component that asks for 1 accepts a ctm-libs at 2,
and it cannot catch a component that is too old for ctm-libs. Breaking
changes are handled by the package: CTM Assessment builds ctm-libs and the
components from pinned commits, tests them together and ships them in one
version, so a change to ctm-libs' interface lands together with the
components that use it. When a component starts to need something new from
ctm-libs, raise `ctm.api` in `lua/ctm.lua` and let that component pass
`{api = n}`; the bootstrap itself stays as it is, so the other components'
copies need no change.

## The ai-feedback forwarder

`templates/ai-feedback/` is the forwarder pyodide-interaktiv ships next to
its copy of ctm-libs (its `scripts/sync-ctm-libs.py` copies it): three files,
`filters: [ai-feedback]` with one deprecation warning, and
`feedback-quarto.lua` for older loaders. Its manifest carries ctm-libs'
version (the sync script below). It is no extension of this repository.

## Python runtime

`runtime/pyodide-runtime.js` names the Pyodide version (`indexURL`), the one
constant: Lua reads it (`ctm.runtime.indexURL()`), and pyodide-interaktiv's
worker uses it, so pages with Pyodide cells grade on the version they run (E12).
A new version changes the browser's SymPy and Python: it is gated by the
umbrella's Pyodide parity harness (every exercise of the example sites and
courses under both versions), by `tests/browser/worker.mjs` (the prefetch
requests the URLs `loadPackage` requests), by pyodide-interaktiv's plot tests
(`plots_test.qmd`, the canvas backends) and by the umbrella's Pyodide cell
parity run over the courses (T13); it goes in a commit of its own. CI's
native checks use the SymPy version that Pyodide ships.

`runtime/pyodide-sympy.json` records that SymPy version, `{pyodide, sympy}`,
generated by `scripts/sync-pyodide-sympy.py` from Pyodide's own lock file
(`pyodide-lock.json` of the npm package that `package.json` pins and
`package-lock.json` binds by integrity; run `npm ci` first). It is the one
source of the SymPy version for build-time SymPy outside the browser:
ctm-stack's native build grades authored tests in host CPython and pins its
host SymPy (`requirements.txt`) to this file's `sympy`, checked in its CI at
the ctm-libs commit it pins; the browser refuses a question whose host SymPy
differs (`python-checker-identity`). `--check` (test.yml) fails when the
Pyodide pins of `package.json`, `package-lock.json`, the installed package
and `indexURL` disagree, or when the file differs from the lock file. A
Pyodide upgrade regenerates it in the same commit; when SymPy changes, the
ctm-stack change that repins ctm-libs moves its host pin with it.

`runtime/pyodide-worker.js` (CTMWorker) came from pyodide-interaktiv 1.8's
`qpyodide-document-engine-initialization.js`. Its tests: `tests/worker*.test.cjs` with a fake Pyodide and network,
and `tests/browser/worker.mjs` in Chromium with real Pyodide (needs the
network or `PYODIDE_DIST`, a folder with the distribution's files).
