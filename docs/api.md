# ctm-libs API

For maintainers of CTM components. Course authors never use ctm-libs
directly: they install CTM Assessment, which bundles it.

- [Loading ctm-libs from a component](#loading-ctm-libs-from-a-component)
- [Lua: ctm.settings](#ctmsettings) · [ctm.locale](#ctmlocale) ·
  [ctm.feedback](#ctmfeedback) · [ctm.runtime](#ctmruntime) · [ctm.checkers](#ctmcheckers) ·
  [ctm.deps](#ctmdeps) · [ctm.ui](#ctmui) · [ctm.sections](#ctmsections) · [ctm.source](#ctmsource)
- [Browser: dependencies and globals](#browser-dependencies-and-globals) ·
  [CTMLocales](#ctmlocales) · [MathExerciseRuntime](#mathexerciseruntime) ·
  [CTMNav and CTMReveal](#ctmnav-and-ctmreveal) · [AIFeedback](#aifeedback-api-v1)

## Loading ctm-libs from a component

A component copies [`bootstrap/ctm-bootstrap.lua`](../bootstrap/ctm-bootstrap.lua)
next to its filter, byte for byte (the CTM Assessment build compares the
copies), and loads the page's instance with it:

```lua
local ctm = dofile(quarto.utils.resolve_path("ctm-bootstrap.lua"))("math-exercise")
-- A component that also works without the package, with the ctm-libs it ships
-- (pyodide-interaktiv, decision 5), and needs interface level 2:
local ctm = dofile(quarto.utils.resolve_path("ctm-bootstrap.lua"))("pyodide-interaktiv",
  {standalone = "quarto add Erasmus-CTM/pyodide-interaktiv@feature/shared-feedback-integration", api = 2})
```

The bootstrap

1. requires the CTM Assessment package: a `ctm-assessment` extension next to
   the component (the package layout) or in the project's `_extensions`
   (also under an owner folder). Without it the render stops with
   `Install CTM Assessment: quarto add https://erasmus-ctm.github.io/ctm-assessment/ctm-assessment.tar.gz`.
   Component development builds and component CI set `CTM_COMPONENT_DEV=1`
   to build against a ctm-libs installation without the package. With
   `standalone` the package is not required;
2. finds ctm-libs next to the component first (`_extensions/ctm-libs` in the
   package, or the same owner folder), then in the project's `_extensions`
   (`ctm-libs` or `<owner>/ctm-libs`; the nearest `_extensions` for a
   single file), and stops with the same install command when there is none
   (with `standalone` and no package: "needs its library ctm-libs, which is
   missing next to it. Install <component> again: <standalone>");
3. checks the interface level: `ctm.api >= opts.api` (default 1). Older
   components ask for 1 and accept a newer ctm-libs; `>=` is the whole rule,
   so a change that would break a component goes through the package's pins,
   not through the level. Without the package a component with `standalone`
   names its own install command here too.

`ctm.api` is 2 since step 3 of the consolidation (CTMWorker,
`ctm.runtime.worker`/`indexURL`, the `pyodide` settings section with
`settings.bool`'s `digits`, the `pyodide-interaktiv` catalogue).

Every filter of a page gets the same instance (`_G.__ctmLibs`); a page that
would combine two installations of different versions stops. The instance
has `ctm.dir`, `ctm.version`, `ctm.api`, `ctm.path(...)` (absolute path of a
file of the installation) and `ctm.filters()` (the passes of the
`ctm-libs` filter: Meta, Callout, the page's interface (`ctm.ui`, two
passes), then AI feedback's preparation) and `ctm.fail(message)` (stops the
render with a message for authors: Quarto's `error` only logs, and `assert`
on a string puts the Lua file and line in front of it). Modules load on
first use.

Rules inside ctm-libs: paths only from its own installation (never
`quarto.utils.resolve_path` or relative dependency paths, which resolve
against the running component); HTML only (neutral values for other
formats); authoring errors stop the render with `ctm.fail(message)`.

### ctm.settings

Every CTM section (`ai-feedback`, `ctm-assessment`, `math-exercise`,
`py-exercise`, `pyodide`) is read key by key from `_quarto.yml`, the active profiles
(the first listed wins), `_quarto.yml.local`, the `_metadata.yml` files from
the project root to the page and the page's front matter, plus Quarto's
merged metadata ([precedence](reference.md#settings)). A page that sets one
key of a section keeps the project's other keys.

```lua
ctm.settings.load(meta)                          -- every entry point, once per page (the first call counts)
ctm.settings.get(section, key, opts)             -- value, origin, section
ctm.settings.string(section, key, opts)          -- lists are joined, as pandoc.utils.stringify did
ctm.settings.bool(section, key, opts)            -- true/false or "true"/"false"; else stops, naming key and origin
                                                 -- (opts.digits: also 1/0 and true/false in any case)
ctm.settings.number(section, key, opts)          -- opts.positive (> 0), opts.unit ("seconds") for the message
ctm.settings.choice(section, key, values, opts)  -- one of values; true/false count as "true"/"false"
ctm.settings.list(section, key, opts)            -- YAML list or comma-separated string -> trimmed strings
ctm.settings.policies()                          -- {json = "<browser policy configuration>", names = {[name] = true}}
```

`opts.default` is the value when the key is unset; `opts.shared` falls back
to `ctm-assessment.<key>` (for `stop-after` and `lang`; a component's own
spelling wins at any level); `opts.loose` (bool) warns and uses the default
instead of stopping, for values that were accepted loosely before 0.9;
`opts.digits` (bool) also takes `1` and `0` (YAML numbers or strings) and
`true`/`false` in any case, the meaning pyodide-interaktiv's on/off options
had before they were read key by key (no other section uses it).
`origin` names the file (`_quarto.yml`, `chapter/_metadata.yml`,
`chapter/page.qmd`) or `document metadata`.

The reader (`read-settings.ts`, one `quarto run` per page) starts on the
first value asked for, and only on HTML pages whose metadata has a CTM
section; without one every value is its default. Its warnings print once;
its errors stop the render in one message.

### ctm.locale

One resolver and one message catalogue ([`locales/`](../_extensions/ctm-libs/locales)).

```lua
local lang, tag, origin = ctm.locale.resolve("py-exercise")   -- "nb", "nn", "page.qmd"
ctm.locale.text("py-exercise", "noscript", lang)              -- a string (or data); extra arguments fill {placeholders}
ctm.locale.use("py-exercise")                                 -- HTML dependencies ctm-locale and ctm-locale-py-exercise
ctm.locale.supported("feedback")                              -- {"en", "de", "nb", "es"}
ctm.locale.tag("ai-feedback", "feedback-language")            -- the raw tag of an option, through ctm-assessment: lang and lang
ctm.locale.language("feedback", "de-CH")                      -- "de": the first language of the chain the catalogue has
ctm.locale.normalize("nb-NO"), ctm.locale.chain("nn")         -- "nb"; {"nn", "nb", "en"}
```

A component's language is its own option (`math-exercise: lang`,
`py-exercise: lang`, `pyodide: lang` for `"pyodide-interaktiv"`;
`ai-feedback: ui-language` for `"ai-feedback"`), then
`ctm-assessment: lang`, then Quarto's `lang`, then `en`; then the first
language of that tag's chain the namespace supports (`nb-NO` → nb, en;
`no` → nb; `nn` → nn, nb, en; `de-CH` → de, en). A text a language lacks
falls back to English with one build warning.

### ctm.feedback

```lua
ctm.feedback.prepare(doc)                         -- idempotent page preparation (loads the settings itself)
ctm.feedback.markCallout(callout)                 -- Callout pass: hidden callouts never reach a feedback context
ctm.feedback.selection(block, opts)               -- {exercise = label or id, name = feedback-policy}
ctm.feedback.context(block, opts, isPyodide)      -- {mode = auto|explicit|none, refs, text}
ctm.feedback.enabled()                            -- true, or false and the reason (P22)
ctm.feedback.request(component, wanted, origin)   -- wanted and enabled; a refused wish is named in the page's build message
ctm.feedback.flush()                              -- prints that message now, or stops for without-ai (ctm-libs-end.lua; the package lists it last)
```

`prepare` registers the `ai-feedback` dependency, `window.__aiFeedbackConfig`
and `window.__aiFeedbackPolicies`, turns `.ai-feedback` activities into
`.ai-feedback-activity` with their data, and records for every code cell the
prose of its section (`data-ai-feedback-context`) before components convert
the cells. With an explicit context the context blocks are left out of that
prose (A5). `selection` and `context` need the page's settings: call them
after `prepare` or after `ctm.settings.load`.

Without AI feedback (P22: `ai-feedback: enabled: false` or `CTM_FEEDBACK=off`)
`prepare` writes nothing of AI feedback, `selection` still checks the policy
name and leaves it out, `context` returns mode `none`, and the Meta pass sets
`pyodide: feedback: false` for pyodide-interaktiv 1.8. A component asks with
`request("math-exercise", wanted, "feedback: true in _quarto.yml")`, and only
for blocks that are on the page; whatever a page asked for but did not get
(those requests, its exercises that only AI feedback can assess, its pyodide
cells under an explicit `pyodide: feedback: true`, its own
`ai-feedback: enabled: true`) is listed in one build message per page. The
package prints it from `ctm-libs-end.lua`, which it lists after every CTM
filter, including any that runs at a later `at:` stage; elsewhere the message
is printed when Pandoc closes the page's Lua state. A CTM filter running after
the end filter that leaves out something new produces a second message (from
that fallback).

### ctm.policy.withoutAI: exercises that only AI feedback can assess

In a build without AI feedback, an exercise without a static check could not
be assessed at all; `ai-feedback: without-ai` decides what becomes of it
(reference.md). ctm-libs finds its own `.ai-feedback` activities in
`prepare`'s walk. A component decides about its exercises with its own parser
and asks, for each exercise that has no static check:

```lua
local withoutAI = ctm.policy.withoutAI   -- nil in ctm-libs before it: check for it
local decision = withoutAI and withoutAI({
  component = "math-exercise",                              -- names it if the filter order is wrong
  kind = "math-exercise in custom mode without a checker",  -- for the error
  name = opts.label,                                        -- or nil: the start of `text` names it
  text = questionText,
  lang = lang,                                              -- the component's interface language
})
-- nil: AI feedback is on (or an older ctm-libs); render the exercise as usual.
-- {action = "text", note = <Div>}: the question without answer box and Check
--   button, followed by `note` (common.withoutAI, marked with lang where the
--   page's language differs);
-- {action = "drop"}: leave the exercise out.
```

ctm-libs names the exercise in the page's build message, or, when
`without-ai` is unset, in the one error that stops the build (the action is
then `text`). The error and the message come from `flush()` in
`ctm-libs-end.lua`, which the package lists after every component; it
announces itself when Quarto loads it (`_G.__ctmLibsEnd`) and when it runs
(`_G.__ctmLibsEndRan`). Without it on the page the error comes at once (at
the end of `prepare` for activities, at the first such exercise of a
component). A CTM filter that runs after it stops a build without AI
feedback with the expected order; with AI feedback, a build warning names
it and the build goes on. Under `self-check` an exercise is `text` until it has a model
answer to compare with; none has one yet.

### ctm.assets

The shared asset URL switch reads `ctm-assessment: assets: cdn | local`
(default `cdn`). Load settings before using it, as for the other modules.

```lua
ctm.assets.mode()                        -- "cdn" or "local"
ctm.assets.url("katex", "dist/katex.mjs")  -- CDN URL, or <page offset>/_ctm-assets/...
ctm.assets.url("pyodide")                 -- selected base URL, with a trailing slash
ctm.assets.use()                         -- CTM_ASSETS and the CTMAssets browser resolver
```

Names and npm versions come from this installation's `assets.json`.
Pyodide's version comes only from the constant in `runtime/pyodide-runtime.js`;
board versions come only from the assessment package's `jsxgraph-pins.yml`.
The hook's private marker controls which default board URLs may be replaced;
author overrides do not change the asset versions.
Paths stay inside the named asset; absolute paths, parent traversal, queries
and fragments are rejected.

Local mode requires a matching `_ctm-assets/manifest.json`,
`project.resources: ["_ctm-assets/**"]` and the `offline.scss` theme
(`offline-system.scss` for a single-file build using system fonts).
A Pyodide `base-url`/`build-variant` override or author HTTP board URL stops
the render. A non-HTTP author board path is kept. Explicit
`pyodide.packages` must be present in the served subset lock.
The installer and bundle verification remain the package builder's job.

### ctm.runtime

```lua
ctm.runtime.use()                      -- HTML dependency ctm-runtime (runtime/pyodide-runtime.js, head)
ctm.runtime.stopAfter("py-exercise")   -- seconds before a running check offers Stop: <component>: stop-after,
                                       -- ctm-assessment: stop-after, 20
ctm.runtime.indexURL()                 -- selected CDN/local Pyodide base URL
ctm.runtime.defaultIndexURL()          -- canonical CDN constant (version source for the asset resolver)
ctm.runtime.worker()                   -- dependencies ctm-runtime and ctm-worker (runtime/pyodide-worker.js, head),
                                       -- and coi-serviceworker.js (below), once per page
```

`ctm.runtime.worker()` writes `runtime/coi-serviceworker.js` (pyodide-interaktiv
1.8's file, byte for byte) into the project's output directory (next to the
page for a single file) and adds `<script src="<offset>/coi-serviceworker.js">`
to the head, `<offset>` being `quarto.project.offset`, so every page at every
depth loads the one file at the output root. On hosts without COOP/COEP
headers (GitHub Pages) it makes the page cross-origin isolated after one
reload, which `input()` and a graceful Stop need. It keeps its `qpyodide`
names: `globalThis.qpyodideCoiOutcome` (`"ready"` or `"unavailable"`), the
events `coi-sw-ready` and `coi-unavailable`, the session key
`qpyodide-coi-reload-pending` and the local key
`qpyodide-coi-unavailable-<origin>`; the reload itself is the page's to do
(pyodide-interaktiv's status line). Under `embed-resources: true` the script
is inlined and cannot register itself; Python works without isolation (Stop
restarts the worker).

### ctm.checkers

ctm-checkers, the Python checker library of CTM Assessment, is a folder of
its own (`checkers.json`, the wheel, the page script `ctm-checkers.js`), which
the package installs next to ctm-libs. A component that grades with it:

```lua
ctm.checkers.require("math-exercise", 1)  -- once per page: stops the render when ctm-checkers is not installed
                                          -- (install command) or has another API level (update command);
                                          -- returns checkers.json. Compatible: the same major level and at
                                          -- least the required minor level (1, "1.2").
ctm.checkers.use([part])                  -- HTML dependency ctm-checkers (ctm-checkers.js, head); with part "stack"
                                          -- also ctm-checkers-stack (ctm-checkers-stack.js, after it)
ctm.checkers.manifest()                   -- checkers.json: name, version, api, dependency, wheel, sha256, script,
                                          -- parts (ctm-checkers 0.2: parts.stack, the STACK engine)
ctm.checkers.wheel([part])                -- absolute path of the wheel, or of the part's wheel
ctm.checkers.environment(env[, part])     -- env (default: this process's environment) with the wheel first
                                          -- on PYTHONPATH (";" on Windows), the part's wheel after it, and
                                          -- CTM_CHECKERS_WHEEL, for pandoc.system.with_environment around
                                          -- build-time Python
ctm.checkers.folder()                     -- the installation used, or nil
```

The installation used is the one next to ctm-libs (the package) first, else
the project's `_extensions/[owner/]ctm-checkers` (`quarto add` of a
ctm-checkers checkout, for component development). On an older ctm-libs
`ctm.checkers` is nil: check for it and stop with the update command. The
dependency's version is `checkers.json`'s `dependency`, a release's version,
or `X.Y.Z.devN+<sha8 of the wheel>` for a development version, so its path
(`site_libs/quarto-contrib/ctm-checkers-<dependency>/`) changes with the
wheel. Static hosts serve that `+` (a test serves it); one that reads `+` in
a path as a space (classic S3 website endpoints) would not.

From ctm-checkers 0.2 its STACK engine has a wheel and page script of its
own (`checkers.json` `parts.stack`), so that pages with math-exercise never
carry it: a component that grades STACK questions (stack-sympy) passes
`"stack"` to `use`, `wheel` and `environment`; a ctm-checkers without that
part stops the render with the update command.

### ctm.deps

```lua
ctm.deps.installed("jsxgraph")             -- next to ctm-libs, or in the project's _extensions
ctm.deps.folder("ctm-checkers")            -- that installation's folder (next to ctm-libs first), or nil
ctm.deps.uses(doc)                         -- {["ai-feedback"] = true, jsxgraph = true} for the page's blocks
ctm.deps.requireUsed(doc, "math-exercise") -- stops with the install command when .jsxgraph blocks lack JSXGraph
ctm.deps.html{name = ..., scripts = {"locales/common.js"}}  -- add_html_dependency with files of ctm-libs
                                           -- (an absolute path: a file of another installation)
```

### ctm.ui

The page's interface ([reference](reference.md#the-pages-interface-reveals-the-switch-embedded-pages-links-into-tabs)):
reveals, the lecture/reading switch, embedded pages, the tab links'
dependencies and `markdown-lint`.

```lua
ctm.ui.passes()                       -- {{Div, Proof, Tabset}, {Pandoc}}: what ctm.filters() runs before ctm.feedback.prepare
ctm.ui.rawHTML(lines)                 -- what markdown-lint names in one file's lines: {{rule, line, text, raw}}, in order;
                                      -- rule: "details" (a <details>, or a <summary> not right after its <details>),
                                      -- "anchor" (<div id="…"></div>), "iframe", "switch" (data-learning-mode); once per line
ctm.ui.defaultTitle(kind, lang)       -- "Gå i dybden" for ("reading-step", "nb"): the title a reveal shows without title=;
                                      -- kind "reading-step", "hint", "solution" or "details", lang a language of the ui
                                      -- catalogue (ctm.locale.language("ui", tag)); another kind is an error
```

`markdown-lint` names, per rule, the lines `rawHTML` gives for the page and
each file it includes; reveals without `title=` show `defaultTitle`.

A component that runs after ctm-libs (the package's order) meets a reveal as
`RawBlock <details class="ctm-reveal <kind>">`, `RawBlock <summary>`, the
title (`Plain`), `RawBlock </summary>`, `Div.ctm-reveal-body` with the
content, `RawBlock </details>`. Its own `<details>` keep the courses'
generic `details > summary` look; `ctm-ui.css` styles `details.ctm-reveal`
only.

### ctm.sections

The structure AI feedback's context follows: a section is a heading or a
tab; closed material (a `<details>`, raw or a reveal, a collapsed callout)
is a scope whose content belongs to it.

```lua
ctm.sections.walk(blocks, hooks, state)   -- the blocks, in source order, as the hooks changed them
ctm.sections.tabset(b)                    -- a Tabset's data ({tabs, attr}) or nil (warns once if unreadable)
ctm.sections.custom(b, "Callout")         -- Quarto's data of a custom node: nil, or false when unreadable
ctm.sections.detailsTags(b)               -- the <details> tags of a raw HTML block, true for an opening one
ctm.sections.collapsed(b)                 -- a collapsed callout
```

The hooks (all optional): `skip(b, tabset)` passes a block through;
`header(b, state)`; `open(state) -> token` and `close(state, token)` around
a scope (a `<details>`, a collapsed callout, a tabset; a `<details>` left
open ends with its list); `tab(tab, state)`; `block(b, state, walk) -> true,
replacement` takes a block over (`walk(blocks)` goes on inside it); `term(inlines,
state)` for a definition list's term; `leaf(b, state) -> b` for any other
block.

### ctm.source

The page's Markdown, for messages that name a file and line (Quarto does not
say where a block came from). Includes resolve as in Quarto, nested ones too:
relative to the page, or to the project when they start with `/`.

```lua
ctm.source.pageName()          -- "pages/x.qmd", with " (or a file it includes)" when it includes files
ctm.source.files()             -- the page and its {{< include >}} files, nested too: {{path, label, lines}}
ctm.source.read(lines)         -- one file's lines as markdown-lint reads them: per line {text, raw} for Markdown (text
                               -- without inline code and comments, blank for a comment alone; raw inside ```{=html}),
                               -- false for code (fenced or indented), a fence's own lines and front matter
ctm.source.scan(visit)         -- visit(text, file, line, raw) for each line of files() that read() gives a text
ctm.source.fences("details")   -- {{where = "file:line", attributes = "{...}"}} of the fenced divs with that class
```

### Outside a render: maintainer tools

`ctm.source.read`, `ctm.ui.rawHTML` and `ctm.ui.defaultTitle` need no page,
so a tool can apply ctm-libs' own reading of a course instead of a copy of it
(CTM Assessment's `tools/migrate-course-html.py` converts and lints a
course's raw HTML with them). It runs them with Quarto's Pandoc, which has no
`quarto` module; `defaultTitle` reads the catalogue with `quarto.json`:

```lua
-- quarto pandoc lua tool.lua <ctm-libs extension folder>
quarto = {json = pandoc.json}
local ctm = dofile(pandoc.path.join({arg[1], "lua", "ctm.lua"}))
local found = ctm.ui.rawHTML(lines)                  -- lines: a file's lines, {"…", …}
local title = ctm.ui.defaultTitle("solution", "nb")  -- "Løsningsforslag"
```

A tool checks that the functions exist (older ctm-libs have none) and names
the ctm-libs it needs. `tests/markdown-api.test.cjs` runs them this way.

## Browser: dependencies and globals

| Dependency (stable name) | Files (head) | Registered by | Global |
|---|---|---|---|
| `ctm-locale` | `locales/ctm-locale.js`, `locales/common.js` | `ctm.locale.use()` | `CTMLocales` |
| `ctm-locale-<namespace>` | `locales/<namespace>.js` | `ctm.locale.use(namespace)` | (adds the catalogue) |
| `ctm-runtime` | `runtime/pyodide-runtime.js` | `ctm.runtime.use()` | `MathExerciseRuntime` |
| `ctm-worker` | `runtime/pyodide-worker.js` | `ctm.runtime.worker()` | `CTMWorker` |
| `ctm-checkers` | ctm-checkers' `ctm-checkers.js` (its version: `checkers.json`'s `dependency`) | `ctm.checkers.use()` | `CTMCheckers` |
| `ctm-checkers-stack` | ctm-checkers' `ctm-checkers-stack.js` (its version: `parts.stack.dependency`) | `ctm.checkers.use("stack")` | `CTMCheckersStack` |
| `ai-feedback` | `feedback/feedback-core.js`, `feedback-dom.js`, `ai-feedback.js`, `ai-feedback.css` | `ctm.feedback.prepare` (when on) | `AIFeedback` |
| `ctm-ui` | `ui/ctm-ui.css` | `ctm.ui` (reveals, the switch, embedded pages, tab links) | |
| `ctm-reveal` | `ui/ctm-reveal.js` | `ctm.ui` (pages with reveals) | `CTMReveal` |
| `ctm-nav` | `ui/ctm-nav.js` | `ctm.ui` (pages with a tabset or a reveal, unless `tab-links: false`) | `CTMNav` |

All but `ctm-checkers` and `ctm-checkers-stack` carry ctm-libs' version. Quarto keeps one dependency per name, so each
file loads once per page whatever the mix of components, as a cacheable file
(inlined only with `embed-resources`). Configuration objects stay inline
before the body: `window.__aiFeedbackConfig`, `window.__aiFeedbackPolicies`.

### CTMLocales

```js
CTMLocales.add(namespace, catalogue)        // what each locales/<namespace>.js does
CTMLocales.table('math-exercise', 'nb')     // compiled messages: strings, data and functions (L.resPartial(50))
CTMLocales.t('py-exercise', 'allPassed', 'de', 3)
CTMLocales.format('ctm-stack', 'partial', 'nb', {pct: 50}) // named arguments in catalogue $args order
CTMLocales.resolve('py-exercise', 'nn')     // 'nb'
CTMLocales.normalize('nb-NO'); CTMLocales.chain('nn'); CTMLocales.languages('feedback')
```

`format(namespace, key, tag, args)` uses the same compiled messages, language
fallbacks, references, plurals and lookups as `t`. Named argument insertion order
does not matter. An unknown message key returns `undefined`, allowing a producer's
English text to be used as a fallback. As with `t`, the caller owns escaping and
typesetting and must normalize structured argument values before interpolation;
the library has no backend-specific message rules. `t` and `table` retain their
positional interfaces.

A key a language lacks falls back to English, with one console warning per
table. Catalogue entries: a string (may hold HTML), data (arrays, objects
without `$` keys), `{"$ref": "common.stop"}`, `{"$t": "Row {row}", "$args":
["row"]}` (optionally `"$lookup": {"form": "formNames"}`, a data entry with a
`"*"` default), and plurals `{"$args": ["n"], "$plural": "n", "one": "...",
"other": "..."}` (`one` when the argument is exactly 1). See
[development](development.md#messages) for adding messages.

### CTMAssets

`CTMAssets.url(name, path = '')` resolves the selected asset base against
`document.baseURI` and always returns an absolute URL, also for nested
pages. Resolve worker URLs on the page before creating a blob worker.
`CTM_ASSETS` is a versioned record `{v: 1, mode, bases}` generated by Lua;
consumers read URLs through the resolver rather than copying versions.

### MathExerciseRuntime

The page-wide Python runtime (Pyodide from jsDelivr, or pyodide-interaktiv's
worker when that is on the page): `indexURL`, `loadTimeout`, `loadScript`,
`ensurePyodide`, `installModule`, `forgetModules`, `ensureGuard`,
`ensureCheckers`, `callCheckers`, `scriptURL`, `canStop`, `stop`,
`stopCount`, `whenSlow`. A copy with this interface (`ensureCheckers`)
replaces an older one that loaded first.

```js
await MathExerciseRuntime.ensureGuard(py);             // the guard module _ctm_guard (snapshot, restore)
await MathExerciseRuntime.ensureCheckers(py);          // ctm-checkers from the page's ctm-checkers.js
const text = await MathExerciseRuntime.callCheckers(py, 'math_exercise.check', request);   // JSON text
MathExerciseRuntime.forgetModules(py);                 // the next ensure* installs again
```

`canStop({runtime})`, `whenSlow(ms, callback, {runtime})` and
`stop(reason, {runtime})` select that worker proxy, including an unpublished
STACK runtime. Omitting the options keeps selecting `mainPyodide`.
`stopCount({runtime})` counts only that runtime's stops; the no-argument count
remains the default-runtime UI's counter. Stopping one proxy does not prevent
another runtime's checker retry or cleanup.

On an isolated page with the proxy's interrupt buffer, Stop sends SIGINT first.
If its active RPCs settle within two seconds, the session is retained and the
interrupt buffer is cleared. Otherwise only that worker restarts. Without a
shared interrupt buffer Stop restarts immediately. `stop` returns the selected
operation's promise when asynchronous; callers can observe restart failures.

`py` is a runtime or an object with `globals.set` and `runPythonAsync`
(pyodide-interaktiv's worker proxy); nothing else is used.

- `ensureCheckers(py[, payload])` installs ctm-checkers once per runtime
  and payload with its page script's own install code
  (`CTMCheckers.install(py)`, which checks the wheel's SHA-256 and imports
  `ctm_checkers` from the wheel); `payload` defaults to the page's
  `CTMCheckers`; `CTMCheckersStack` (stack-sympy's worker) installs
  ctm-checkers and its STACK engine. A page with math-exercise alone has no
  STACK module to load. Both work in one runtime, in any order: after
  `CTMCheckers`, `CTMCheckersStack` installs the ctm-checkers wheel a second
  time (its install includes it); and since ctm-checkers' own install
  replaces the whole package, `CTMCheckers` installed after the STACK
  engine (or again, for a repeated call) makes the runtime forget the STACK
  engine, which the next STACK call installs again. The installs and the
  calls of one runtime run one after another, in one queue, so no call runs
  while an install replaces the package: any order of `ensureCheckers` and
  `callCheckers` works, also a component's direct `ensureCheckers` (as
  stack-sympy's worker and math-exercise make when they start) while
  another component's call waits. Then it imports every
  module of the library, so that no call reads the wheel file again (learner
  code that deletes or overwrites `/tmp/ctm-checkers` breaks no later call),
  and removes the names that the install code of ctm-checkers 0.1 (as in
  CTM Assessment 0.10.0) leaves in the namespace (`_ctm_import`,
  `_ctm_globals`; the call text below needs neither; later versions leave
  none).
  Without ctm-checkers.js on the page it fails with a message.
- `callCheckers(py, name, request[, payload])` runs ctm-checkers' call
  `name` (`math_exercise.check`, `math_exercise.check_custom`; with the
  payload `CTMCheckersStack`, `stack.validate`, `stack.grade`, `stack.tests`) on `request`
  (ctm-checkers `docs/api.md`) and returns its JSON text. It sets
  `_ctm_request` and runs a call text that looks up no name in the
  namespace learner code shares (`import builtins as _ctm_builtins`, then
  `_ctm_builtins.__import__("ctm_checkers.browser", …).call(name,
  _ctm_builtins.globals())`), in the same namespace as the request, so
  learner code that rebinds a name there (`__import__`, `globals`,
  `builtins`, a `_ctm_` name) does not affect it. Afterwards
  `_ctm_request`, `_ctm_builtins` and the install code's names are removed
  from the namespace. This is the call text that ctm-checkers' `docs/api.md`
  documents (from 0.2.0; it works with 0.1 pages too). The calls of one runtime run one after another, in the
  same queue as its installs: pass the runtime object that `ensurePyodide`
  returned, so that every caller queues on the same one. A runtime that
  hangs holds up only its own calls and installs.
- When the call text failed before it reached ctm-checkers' `call`
  (learner code removed ctm-checkers or rebound what the import uses),
  ctm-checkers is installed again and the call repeated once. The cleanup
  tells: `call` takes `_ctm_request` out of the namespace before anything
  else, so a request still there after a failure means the call text
  failed. This needs no traceback, which learner code may turn off
  (`sys.tracebacklimit = 0`). The second failure reaches the caller, as
  does an error that `call` raised itself (the answer to the request, such
  as the admission rule's `ValueError`).
- A runtime that was restarted gets nothing more, since
  pyodide-interaktiv's terminated worker never answers. The evidence is a
  Stop that actually restarts the proxy, or pyodide-interaktiv's
  `qpyodide-runtime-restart` event with `detail.proxy` equal to the published
  runtime, which `restart()` sends before it
  rejects the pending calls. Ordinary runtime errors do not count; the exact
  legacy restart signal `Python was restarted.` is retained. The
  failed call reaches the caller at once with no cleanup or repeat, and the
  caller moves to the new runtime. Every later call or install for that
  runtime, including one waiting behind the failed call, fails at once.
  An interrupted session that settles in time remains available; its stopped
  checker call is not retried or cleaned up through additional Python calls.
- `_ctm_guard`'s snapshot keeps the modules named `_ctm_…` and
  `ctm_checkers…`: a checker that removes them is undone after its call.
- `scriptURL` is the runtime script's own URL on a page (for a worker that
  loads it with `importScripts`); a worker loads ctm-checkers.js the same
  way before `ensureCheckers`, so the install and the calls use the worker's
  namespace.

### CTMWorker

Python in a Web Worker for a page, with the RPC proxy other components use
(moved from pyodide-interaktiv 1.8 in step 3; step 5 starts the same worker
for standalone pages). Python runs in its own thread; on a cross-origin
isolated page `interrupt()` stops a computation with a `KeyboardInterrupt`
and `input()` works through `Atomics.wait`; otherwise Stop restarts the
worker.

```js
const started = CTMWorker.start({
  indexURL,                     // ctm.runtime.indexURL(), or a project's pyodide: base-url + build-variant
  env: {HOME: '/home/pyodide', MPLBACKEND: 'AGG'},
  packages: [],                 // stage 1: micropip in CDN mode; subset loadPackage in local mode
  background: {                 // stage 2: never in a check's way (below)
    packages: ['pyodide_http', 'micropip', 'matplotlib'],
    run: 'import pyodide_http\npyodide_http.patch_all()'},
  plugin: SOURCE,               // worker-side code: registerPlugin(api => ({commands: {runCell: async msg => ...}, stage1: 'Python'}))
  commands: {runCell: ['code', 'wantPickle']},   // the plugin's commands on the proxy, with their arguments
  messages: {loading, initPackages, extraPackages},   // status texts, in the page's language
  onStatus(text) {},            // a status text from the worker
  onRestart(started) {},        // after proxy.restart(): the new start
  loadTimeout: 180000,          // initialization ceiling in milliseconds, excluding background setup
  publish: true,                // qpyodideReady, qpyodideInstance, _qpyodideGetInstance, mainPyodide
});
const proxy = await started;    // after stage 1
await proxy.whenSetup;          // after stage 2 (rejects with the reason; proxy.retrySetup() tries the missing steps again;
                                //   after proxy.restart() it rejects with the restart's error, error.restarted === true)
```

In local mode `CTMWorker.start` resolves the absolute Pyodide base through
`CTMAssets` on the page. Explicit packages are checked against the served
subset lock and loaded by Pyodide, without a micropip/PyPI request.
`loadTimeout` defaults to `MathExerciseRuntime.loadTimeout`, or 180000 ms.
It must be positive, finite and at most 2147483647 ms. A loading deadline
terminates only this worker and rejects with `code: 'pyodide-timeout'`.

**The proxy** (`await qpyodideReady`, `mainPyodide`; a test pins its keys):
`runPythonAsync(code)` (the result through `toJs({dict_converter:
Object.fromEntries, create_pyproxies: false})`), `loadPackagesFromImports(code)`,
`loadPackage(name)`, `globals.set(name, value)`, `toPy(value)` (identity: the
conversion happens in the worker), `isWorkerProxy`; control: `interrupt()`,
`clearInterrupt()`, `abortInput()`, `provideInput(text)`, `restart(reason)`
(for `publish: true` fires `qpyodide-runtime-restart` with `detail.proxy`
identifying the old proxy; unpublished workers emit no page restart event;
rejects pending calls and
`whenSetup` with an error whose `restarted` is true, starts again and
publishes the new start; afterwards every call on the old proxy rejects at
once with that error, and `restart` on it again returns the same new start),
`interruptBuffer`, `inputStatusBuf`,
`inputDataBuf`, `onStream(text, "stdout"|"stderr")`, `onInputRequired(prompt)`;
stage 2: `whenSetup`, `retrySetup()`; `whenIdle()` settles after outstanding
RPCs finish (background setup is separate); and the plugin's commands. Calls are
answered in order (one interpreter, one output capture): a check from one
component never enters another's captured output. `MathExerciseRuntime`'s
`ensurePyodide`, `installModule`, `ensureCheckers`/`callCheckers`, `canStop`
and `stop` use this subset.

For an unpublished proxy, `proxy.terminate(reason)` releases the worker, rejecting its pending/setup and
future calls with that error. It emits no page event and starts no replacement.
A page-side backend adapter uses this to clean up a failed or timed-out startup
after the initial proxy is ready (for example, while loading SymPy). The adapter
must bound its entire readiness phase separately from `CTMWorker` initialization.
Published proxies reject this operation before changing state; use their normal
Stop or restart path so page consumers receive the scoped restart notification.

**Plugins.** `registerPlugin(factory)` runs in the worker; `factory(api)`
returns `{commands, stage1}`. `api.pyodide()` is the interpreter;
`api.capture.start()`, `push(entry)` and `entries()` hold the stdout/stderr
of a command (the worker's streams push to it); `api.setPrompt(text)` sets
the prompt the next `input()` request carries (Pyodide's stdout is
line-buffered). `stage1` is Python run once the interpreter is ready.

**The two stages (D2).** Stage 1: the interpreter, the plugins' `stage1`,
and with `packages` micropip and those packages; then the proxy is ready.
Stage 2 fetches the files of the background packages (their closure in
Pyodide's lock file, minus what is loaded) from the URLs `loadPackage` will
request, outside Pyodide's package lock. Each wheel's HEAD response is consumed
to completion first. Visible identity representations use 512 KB byte ranges;
encoded, hidden or unsupported encoding metadata uses a complete GET instead,
because Fetch decodes bytes while range offsets address the wire representation.
Both paths retain final lock-file SHA-256 verification. Requests are sequential
and bypass the HTTP cache when verified wheels can be kept; before each request
it waits while a
command that may download is queued or running (`loadPackage`, or
`loadPackagesFromImports` of a package not yet loaded) and 2 s after the last
one. Then it installs one package at a time, dependencies first, each only
while nothing is queued or running and no command has ended for 300 ms (so
no install slips in between the calls of one check), and runs
`background.run`. An install takes the bytes the prefetch received when
their SHA-256 is the lock file's: the worker answers `loadPackage`'s
request for that URL itself, so an install never downloads (a wheel that
does not verify is fetched by `loadPackage` as usual). The Cache Storage
`ctm-pyodide-wheels` keeps verified wheels, so the next page fetches none of
them; the prefetch then bypasses the HTTP cache. (With jsDelivr's wheel
responses, a weak ETag, `Vary: Accept-Encoding` and no `Accept-Ranges`,
Chromium did not serve `loadPackage`'s full request from the cached ranges.)
On a plain-HTTP origin, without `crypto.subtle` and the Cache Storage, the
prefetch fills the HTTP cache and `loadPackage` fetches the wheels as
before. Commands that never pause for 300 ms cannot hold an
install off for longer than 5 s: after waiting that long, it takes the next
moment nothing is queued or running. Each install's 5 s count from the end
of the one before, so installs under a stream of commands are at least 5 s
apart. A check can share the connection with the remainder of one identity
range or, for the whole-representation fallback, the remainder of that complete
download; the latter has no 512 KB bandwidth bound. A check shorter than 5 s
meets at most one install in progress (numpy is the largest). A download without
a byte for 30 s is requested again after 5 s,
then after 30 s; a third failure rejects `whenSetup` with a short reason
that names the package once (`matplotlib: HTTP 404`); the console has the
URL. So does an install that Pyodide reports as failed (`loadPackage` does
not reject; the reason is Pyodide's, with file names for URLs), and the
steps after it do not run. A restart runs both stages again. Test-only: `globalThis.__ctmWorkerNoBackground = true` skips stage 2.

### CTMNav and CTMReveal

```js
await CTMNav.reveal(element)   // opens its tabs, <details> and collapsed callouts, scrolls it below the header, focuses it
CTMReveal.mode()               // 'lecture' or 'reading'
CTMReveal.select('reading')    // as the switch's button does
CTMReveal.course()             // the course's root path ("/ingmat3a_ntnu/"), from <meta name="quarto:offset">
```

Each history entry keeps its scroll position and open tabs in
`history.state.__quartoTabPosition` (the courses' former `tab-links.html`
used the same key), and while it still shows its link's target, that hash
(`at`): a reload then follows the link again instead of restoring the
position. What a target hides is opened outer to inner: a tab pane through
Bootstrap's Tab, a closed `<details>` by its `open` property, and the content
of a collapsible Quarto callout (`.callout-collapse.collapse`, a callout the
target is, or sits in) through Bootstrap's Collapse (the header's
`aria-expanded` and `collapsed` class follow; without Bootstrap, or when it
does not finish within 0.6 s, the script sets them). A target the script
handled carries `data-ctm-nav` (`load`, `link`, `hash`, `history` or `api`). `ctm-ui.css` sets its colours
as custom properties (`--ctm-reveal-*`, `--ctm-modes-*`, `--ctm-embed-border`)
on `:root`, and again under `.quarto-dark`.

## AIFeedback (API v1)

The JavaScript global is `AIFeedback` (version = ctm-libs' version). The
headless `feedback-core.js` also exports CommonJS for tests. No editor,
checker, Python runtime or DOM is needed to construct requests.

```js
const client = AIFeedback.createClient({
  baseUrl: 'https://llm.hpc.ntnu.no/v1',
  model: 'moonshotai/Kimi-K2.6',
  apiKey: personalKey
});
const reply = await client.request(request, { signal: abortController.signal });
// { text: '...', format: 'markdown' }
```

### Request

| Property | Contract |
|---|---|
| `version` | Optional; must be `1` when supplied. |
| `task` | Required non-empty instruction string. |
| `profile` | `review` (default), `translation`, `language-quality`, `python`, `mathematics`. Supplies default criteria only. |
| `responses` | Array of `{id, value, format?, label?, language?}`. IDs are unique. `format` is `text`, `code`, `latex`, or `json`; value is always a string. Empty fields can accompany nonempty work. |
| `materials` | Optional array of `{id, role, text, language?}`. Role is `source`, `context`, or `reference`. Translation requires source material or a source image. |
| `attachments` | Optional array of `{id, role, label?, dataUrl}`. Role is `source`, `response`, or `context`. PNG/JPEG/WebP data URLs only. Maximum three images; 8 MiB each, 12 MiB combined. |
| `learner` | Optional `{level}`. A course label, not an implicit CEFR classification. |
| `criteria` | Optional string array overriding the profile defaults. |
| `evidence` | Optional array of `{label, text}` containing only assessment information the adapter permits the provider to see. Never pass the whole exercise/test configuration. |
| `feedback` | Optional teaching policy described below. |

At least one nonempty textual response or an image with role `response` is
required. A source image alone is not submitted work. A text-free handwriting
submission uses `responses: []` and an image with role `response`.

Unknown properties are omitted from the provider payload. Text requests are
limited to 100,000 characters independently of the image budget. No material
is silently truncated. Uploaded files and request bodies are not persisted.

`feedback` accepts:

- `language`: explanation language, default `en`; independent of UI, source
  and response languages. Quotations can retain their original language.
- `mode`: `review` (default) or `hints`.
- `maxIssues`: 1–20, default 3; `maxWords`: 20–2000, default 250.
- `allowFullRewrite`: boolean, default false. A teaching instruction, not a
  security boundary or a guarantee of model behavior.
- `steps`: explicit nonempty strings required for hint mode.
- `level`: 1-based step index, default 1.

An adapter can preserve an existing teaching policy, including mathematics'
fourth-step full solution, by setting the current step and rewrite permission.
The core does not infer progression from previous API calls.

### Prompt and transport

`AIFeedback.normalizeRequest(request)` returns a validated snapshot.
`AIFeedback.buildMessages(request)` returns system/user messages.
`AIFeedback.buildPrompt(request)` returns the copyable text from the same
builder. With images, it explicitly asks the learner to attach the original
files separately; image bytes are never placed in clipboard text.

`client.request(request, {signal})` validates, builds messages and sends them.
Provider settings live on the client, separately from learning content.
Requests have a 60-second deadline including response-body reading. Compatible
model controls may be negotiated; network errors, rate limits and server errors
are not blindly retried. Empty and truncated replies are rejected. Reasoning
tags cause one corrective retry. No Latin-only language heuristic applies to
the general API. Provider model names remain freely editable.

The advanced migration API `client.complete(messages, options)` uses the same
transport with caller-built messages. It preserves established subject prompts
without duplicating the provider client. `options.validate(text)` may return a
corrective instruction or a falsy value. It is called before and after one
corrective retry. `imageFallback: 'text'` explicitly permits a text fallback
for an optional illustration. The default rejects unsupported image requests;
activities relying on uploaded images must keep that default.

Errors are `FeedbackError` objects with a stable `code`: `INVALID_REQUEST`,
`CONFIGURATION`, `HTTP`, `NETWORK`, `TIMEOUT`, `ABORTED`, `EMPTY`, `TRUNCATED`,
`REASONING`, `VALIDATION`, `IMAGE_UNSUPPORTED`, or `COMPATIBILITY`.

### UI adapter

```js
const adapter = AIFeedback.attach({
  id: 'exercise-1',
  button: feedbackButton,
  output: feedbackPanel,
  getRequest: () => buildCurrentRequest(),
  // client: optional explicit client; otherwise use shared settings
  // uiLanguage: optional; defaults to document language
  // afterRender: optional callback for mathematical typesetting
});
adapter.cancel();
adapter.dispose();
```

`getRequest` may be asynchronous and must only collect a snapshot. It must not
execute learner code or have other side effects: it is called again to detect
edits during a pending request. The adapter increments hint state only after
a successful, current response (or copy prompt) is displayed. Hint state is
scoped to page path and activity ID in session storage. Review mode never
escalates. The adapter returns `request()`, `cancel()` and `dispose()` methods.

Institutions can set `ai-feedback: base-url:` and `model:` in project YAML.
These are defaults for the settings form; personal keys are never read from
document metadata. There are no bundled provider presets.

Call `AIFeedback.openSettings()` to open the single shared settings panel.
The same cogwheel beside every activity opens one dialog. Base URL, model,
key and mode are shared across all pages on the same browser origin through
one localStorage record by default; session storage is optional. Separate
domains cannot share browser storage. Legacy configurations are offered as
explicit import choices, never silently combined. Supported initial UI languages: English, German, Norwegian Bokmål
and Spanish; explanation languages remain unrestricted.

### Feedback rendering

Model replies render safe Markdown and inline/display LaTeX (`$...$`, `$$...$$`,
`\(...\)` and `\[...\]`). Math is typeset after insertion using a lazy-loaded
KaTeX module, including on pages without initial mathematical content. Code
spans/blocks and copy prompts stay literal. If the renderer cannot load, readable
TeX remains in place. `afterRender` runs after shared typesetting.

### Quarto authoring

Use a fenced Div with `.ai-feedback` and a unique ID. Supported attributes:
`profile`, `ui-language`, `response-language`, `feedback-language`,
`source-language`, `learner-level`, `max-issues`, `context`, `source`,
`image-upload="true"`, and `image-role`. `ui-language` goes through the
language chain (`de-CH` → de); `feedback-language` is passed as written.

Within it, `.feedback-source` supplies visible original text;
`.feedback-criteria` supplies author-selected criteria to the feedback request
without displaying them in the learner's task. Multiple criteria blocks are
collected in order. These are client-side configuration, not confidential data;
`.feedback-starter` initializes the textarea. Remaining prose is the task.

`context="id1,id2"` references tagged context blocks. The canonical class is
`.ai-feedback-context`; `.ai-context` is a short alias and
`.math-exercise-context` is a permanent compatibility alias. Duplicate
IDs are included once, in reference order. Multiple alias classes on one block do not
duplicate it. `context="none"` disables learning context; an explicit `source`
still supplies the source required for the task. Without `context`, recent
section prose is collected at render time, capped at 1,500 Unicode characters
without splitting blocks. The section is the innermost heading or tab (a tab
of a tabset starts one, as a heading does). The content of `<details>` blocks
and collapsed callouts (solutions, reading steps, hints) is not sent as
section prose; blocks an exercise lists explicitly are still sent, and an
exercise inside such a block gets its text. Explicit references share a
6,000-character budget; since 0.9.0 they are followed by the section's own
prose, without context blocks (the listed ones are sent on their own, the
others belong to other exercises), under the same 1,500-character cap.
Missing, untagged, empty or oversized context blocks are skipped with warnings.
An unavailable required translation source produces an error.

Lua preserves LaTeX before rendering. The browser resolver also recognizes the
legacy math metadata and supported MathJax/KaTeX source. UI controls, hidden
content and previous feedback are excluded. Material roles belong to each
reference, so the same tagged block may be context in one task and source in
another.

Adapters using `attach` may define `getRequest({hintLevel})`. The hint level is
frozen for a request and its final stale-response check. Use it to coordinate
step-dependent policy such as allowing a worked solution on step four. The
adapter compares the complete request, including feedback policy, before
rendering; cancellation during either asynchronous collection prevents success.

Since 0.3.0, `handle.cancel({clearOutput: true})` cancels quietly and keeps the
output empty even if network, snapshot collection or typesetting later finishes.
Adapters use this for edits, Reset and execution invalidation. No-argument
`cancel()` retains the visible cancellation notice. Neither consumes a hint.

### Explicit policies

Use `attach({integration: 'math-exercise', ...})` (or `plain-text`, `py-exercise`,
`pyodide-interaktiv`) to resolve shipped and local policies centrally. The adapter
supplies task, responses, domain criteria, evidence and its default explanation
language. `getRequest` no longer needs to choose a hint level or permission.

`handle.reset('run')` quietly cancels pending feedback and resets the counter when
`reset-on-run` is true. Call it at the start of Run/Check. `handle.reset()` always
restarts the sequence; call it on explicit Reset/new pool task. Edits should use
`cancel({clearOutput: true})` and invalidate evidence without resetting progression.

`resolvePolicy(integration, language, runtimeOptions, configuration, selection)`
returns an independent effective policy. `configuration` contains ordered
`layers`/`pageLayers` of named `policies` and targeted `exercises`, plus explicit
`projectPolicy`/`pagePolicy` names or integration selector maps. `selection` is
`{exercise: labelOrId, name: policyName}`. Loading definitions alone has no effect.

`applyPolicy(integration, request, hintLevel, runtimeOptions, selection)` applies
the active base instructions, step instructions, limits and permissions.
`runtimeOptions` supplies integration defaults (for example Pyodide's
`feedback-hints: false` contributes `steps: []`); explicitly selected YAML
policies can override them. `explainPolicy(integration, language, configuration,
selection, runtimeOptions)` returns the effective policy and named scope chains
for author-facing summaries. Adapters pass `policySelection` and `policyDefaults`
to `attach` rather than copying teaching prompts. See [policy authoring](feedback-policies.md).

### Shared context

`AIFeedback.contextMaterials({mode, refs, text})` returns request materials.
`mode` is `auto`, `none` or `explicit`; `refs` is a comma-separated list of
tagged element IDs; `text` is the section prose collected at render time.
`auto` sends the prose; `explicit` sends the listed blocks (6,000-character
budget) followed by the prose of the exercise's own section without context
blocks (0.9.0); `none` sends nothing. All integrations use this API; the Lua
side is `ctm.feedback` (above).

### JSXGraph visual context

Plain-text activities may mix tagged text and explicit diagram references:
`context="lesson, jsxgraph:diagram-id"`. The math-exercise integration supports
the equivalent `#| context:` option from version 0.8.0. `context="none"` still
disables context; a nearby diagram is never attached implicitly.

The iframe must use `assessment_id="diagram-id"` and register its board, a JSON
`response` provider describing current state, and `ai: {render: true}` using
`JXG.QuartoAssessment.register`. The selected board image and state are context;
they do not replace the learner's typed response. Include all relevant changing
geometry and view bounds in the state. Missing boards, failed exports, or state
over 1 MiB fail visibly rather than sending incomplete context. Existing image
size/count limits also apply. No images are saved in browser storage.

Custom adapters opt in with `attach({contextRefs: () => refs, ...})`. The shared
adapter collects `jsxgraph:` references asynchronously before sending and again
when checking for an obsolete response. `contextMaterials` continues to collect
text references; `collectVisualContexts(refs)` returns `{materials, attachments}`
for explicit lower-level integrations. Duplicate diagram references are included
once. Message replies must match the iframe window, protocol, version, request
ID and assessment ID. In copy mode, the UI exposes image previews and download
links so the learner can attach them in their chat.

### P13 page worker

After Monaco's `editor.main` AMD module loads, call
`MathExerciseRuntime.prepareMonacoClipboard()` before constructing an editor.
It guards the pinned WebKit clipboard workaround on insecure/exam pages;
ordinary copy fallbacks and secure course behavior remain available.

`CTMWorker.page(options)` starts or returns the single published page worker;
private backends retain `CTMWorker.start({publish:false, ...})`. Standalone
`ensurePyodide()` requires this dependency and never loads Python on the page.
The default entry is the self-hosted `pyodide-worker-core.js` beside its loader.
`pluginURLs` are self-hosted modules exporting a worker plugin factory. Legacy
source plugins retain the compatibility blob path. Generate/check the static
entry with `node scripts/sync-worker-core.cjs [--check]`.

`MathExerciseRuntime.transaction(py, callback, handlers)` owns an entire Python
operation, including its imports, globals, guard and cleanup. All supported
consumers use it; callbacks must not nest transactions. Optional `onStream` and
`onInputRequired` handlers belong to that operation only. The worker proxy's
`operation` method is the transport primitive. Setup installs yield while an
operation owns Python. Queued operations cancelled by Stop never execute or
replay. A restart invalidates every old proxy; obtain the current one again.

Output is limited to 256 KiB and 4096 entries per operation and sent with one acknowledged batch
in flight. Python exercise semantic capture has a separate write-time budget;
resource overflow cannot be graded against truncated data. Input is UTF-8 and
must fit its 4096-byte shared buffer including its terminator; oversized/null
input is rejected. Input requires isolation and an owned learner input handler.
Graceful Stop has a two-second deadline before hard restart, including programs
that catch KeyboardInterrupt. Python's private executor catches BaseException
before it can escape WebLoop as an uncaught worker event.

A failed page start remains shared until explicit Retry. Retry reuses its status
controls, notifies the consumer of the new start, and uses the normal restart
path after a fatal worker failure. `onFailure(error)` reports fatal worker
failures so IDE controls can disable Run while keeping editing/export available.
A normal Stop/restart is not reported as a fatal failure.
