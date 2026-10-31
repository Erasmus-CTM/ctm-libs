# Reference

[Start here](../README.md) · [API](api.md) · [Installation](installation.md)

Course authors read the same settings in the CTM Assessment guide; this page
is the library's own reference.

## Settings

CTM settings live in five sections of the Quarto metadata:

| Section | Keys |
|---|---|
| `ctm-assessment` | `stop-after` (seconds before a running check offers Stop, default 20), `lang` (the language of every component), `tab-links` (links into tabs and reveals, default true), `modes` (the lecture/reading switch on pages with reading steps, default true), `markdown-lint` (warn about raw HTML that has a Markdown form, default false) |
| `ai-feedback` | `mode` (`copy`, `api`), `storage` (`local`, `session`), `base-url`, `model`, `ui-language`, `feedback-language`, `enabled`, `policy-files`, `policy` |
| `math-exercise` | `lang`, `feedback` (`auto`, `true`, `false`), `stop-after` |
| `py-exercise` | `lang`, `feedback`, `stop-after`, `forbidden-imports`, `forbidden-keywords`, `submission`, `submission-key`, `show-test-hints` |
| `pyodide` | pyodide-interaktiv's options (its own reference): `lang`, `feedback`, `feedback-hints`, `feedback-storage`, `show-startup-message`, `packages`, `base-url`, `build-variant`, `home-dir`, `local-storage`, `local-storage-epoch`, `pdf-fallback`, `<format>-autoexec`; read key by key on HTML pages (1.9 and later) |

Settings combine **key by key** across `_quarto.yml`, the active profiles'
`_quarto-<profile>.yml` (with several profiles the first listed wins, as in
Quarto), `_quarto.yml.local`, the `_metadata.yml` files from the project root
to the page's folder, and the page's front matter. A page that sets one key
of a section keeps the project's other keys of that section. For a key:

| Step | Source |
|---|---|
| 1 | the page's front matter |
| 2 | Quarto's merged metadata: `metadata-files`, `format: html:` scoped settings, notebooks, `-M`; it holds the key unless the page's own map of the section dropped it |
| 3 | `_quarto.yml`, profiles, `_quarto.yml.local`, `_metadata.yml` (the nearest wins) |
| 4 | `stop-after` and `lang` only: steps 1–3 for `ctm-assessment` (a component's own spelling wins at any level) |
| 5 | `lang` only: Quarto's `lang` |
| 6 | the default |

Two exceptions: `ai-feedback: enabled` is off when any level turns it off
(below), and the policy keys follow their own rules ([policies](feedback-policies.md#load-definitions-then-select)).

Checks at render time:

- A key that looks like a credential (`api-key`, `apikey`, `key`, `token`,
  `secret`, `password`, `authorization`, in any CTM section and at any level)
  **stops the render**: Quarto metadata is published with the site. Remove
  the key; learners enter their own key in the Feedback settings. ctm-libs'
  messages never repeat the value. Quarto itself prints a page's metadata
  block, the key included, at the start of every single-file render
  (`quarto render page.qmd`); full project renders do not.
- Unknown `ai-feedback` and `ctm-assessment` options warn and are ignored;
  they become errors in CTM Assessment 1.0. `version` is not an option.
  `stop-after` and `lang` are shared (a component's own spelling wins);
  `tab-links`, `modes` and `markdown-lint` are `ctm-assessment`'s own and
  take `true` or `false` (another value stops the render).
- `mode`, `storage` and `base-url` values that cannot be used warn and fall
  back to the default (a rejected URL is never repeated).
- Values that were accepted loosely before 0.9 (`py-exercise: submission`,
  `show-test-hints`, `feedback` other than true/false; a component section
  that is not a mapping) warn; other wrong values stop the render, naming the
  key and the file. pyodide-interaktiv's on/off options keep the meaning they
  had: true, false, 1 and 0; another value warns once and uses the default.
- `pyodide` gets no unknown-option warnings (older projects carry options
  that pyodide-interaktiv no longer reads).

## Languages

A component's interface language is its own option (`math-exercise: lang`,
`py-exercise: lang`, `pyodide: lang`, `ai-feedback: ui-language`), then
`ctm-assessment: lang`, then Quarto's `lang`, then English; then the first
language of the tag's chain that the component has: `nb-NO` → nb; `no` → nb;
`nn` → nn, nb; `de-CH` → de; anything else → en. Every component speaks
English, German and Norwegian Bokmål; the feedback interface also Spanish,
pyodide-interaktiv also Swedish and Danish, the page's interface (reveals'
titles, the lecture/reading switch; `ctm-assessment: lang`, then `lang`)
also Nynorsk. The feedback's own
language (`feedback-language`) is passed to the AI as written, from the
activity, `ai-feedback: feedback-language`, `ctm-assessment: lang` or `lang`.

## The page's interface: reveals, the switch, embedded pages, links into tabs

Course authors write Markdown only; the CTM Assessment guide shows the
syntax with examples. ctm-libs turns it into HTML in its own pass, after
the settings and before AI feedback's preparation (`lua/ui.lua`).

| Markdown | HTML |
|---|---|
| `::: {.reading-step title="Gå i dybden: …"}` … `:::` | `<details class="ctm-reveal reading-step">`, closed; follows the switch |
| `::: {.hint}`, `::: {.solution}` | `<details class="ctm-reveal hint">`, `… solution">`, closed |
| `::: {.details title="…"}` | `<details class="ctm-reveal details">`, closed |
| `::: {.modes}` + `:::` | where the switch goes (else at the top of a page with reading steps) |
| `::: {.embed src="…" title="…" height="920px"}` + `:::` | `<iframe class="ctm-embed" loading="lazy">`; `src` and `title` required, `height` a length (default 600px) |

- **Reveals.** `<details>` and `<summary>` are raw tags around a
  `div.ctm-reveal-body` that holds the content, so a heading inside a reveal
  stays inside it and what follows stays in place. The `<details>` element
  carries the block's id, other classes and attributes (not `title`, `name`
  or `open`: a reveal starts closed). AI feedback reads a reveal as the scope
  of hand-written `<details>`: the same context, byte for byte.
- **Titles** are inline Markdown: what would start a block ("2. forsøk",
  "- …", "# …") stays text. Pandoc applies backslash escapes in attribute
  values first, so TeX takes doubled backslashes:
  `title="Bruk $\\mathbf{A}\\,x$"`. Default titles:

  | | en | de | nb | nn |
  |---|---|---|---|---|
  | `.reading-step` | Go deeper | Vertiefung | Gå i dybden | Gå i djupna |
  | `.solution` | Solution | Lösungsvorschlag | Løsningsforslag | Løysingsforslag |
  | `.hint` | Hint | Hinweis | Hint | Hint |
  | `.details` | Details | Details | Detaljer | Detaljar |

  A `.details` should say what it holds; `markdown-lint` names one without a
  title.

- **`.solution`** is Quarto's Solution, taken over in HTML. Its `name="…"`
  is an alias of `title`; a heading as its first block is its name too
  (Quarto's rule), so `title=` together with such a heading stops the render.
  Other formats keep Quarto's Solution; the other reveals there show their
  title in bold, then the content; an embedded page becomes a link.
- **The switch** ("Forelesning" / "Gå i dybden"; en "Explore" / "Go
  deeper") is rendered hidden and shown by its script: lecture closes every
  reading step, reading opens them all, for the browser tab and per course
  (`sessionStorage` `ctm|1|<course>|~mode`, the course being the site's root
  path). Loading the page announces nothing; switching does. Printing opens
  the reading steps and hides the switch. `ctm-assessment: modes: false`
  leaves it out.
- **Links into tabs and reveals** (`tab-links`, on by default, on pages with
  a tabset or a reveal): a link to an id inside tabs, closed `<details>` or a
  collapsed callout (`collapse="true"`) — in the page, from another page,
  Back/Forward, reload — opens every enclosing tab, `<details>` and
  collapsed callout, in any nesting, scrolls the target below the header, keeps
  it there while the layout above it settles (2 s at most, until the reader
  scrolls, types or clicks), and focuses it. Back/Forward and a reload return
  to the position the history entry had, except a reload before the reader
  has scrolled, typed, clicked or touched: it follows the link again, as
  after the reload with which coi-serviceworker makes a learner's first
  visit cross-origin isolated. It runs after Quarto's grouped
  tabsets, and wins over their remembered tab without changing it. A tab's
  own id needs CTM Assessment's pre-ast `tab-ids.lua` (Quarto drops ids on
  tab headings); its target is a `div.ctm-tab-target` at the start of the
  pane, and the link then focuses the tab panel with its tab row in view.
- **Errors** name the file and line, also in included files: an `.embed`
  without `src` or `title` or whose height is not a length, two
  `::: {.modes}` on a page, or one with content, a `.solution` with both
  `title=` and a name, a block that is two kinds of reveal.
- **Look.** `ui/ctm-ui.css` keeps the theme's text colours. Backgrounds are
  faint tints over the page: on white they give the courses' colours
  exactly, and under a dark theme they stay dark. The `.details` marker is
  drawn, so screen readers do not read it.
- **`markdown-lint: true`** warns, once per kind and page, about raw
  `<details>`/`<summary>`, empty `<div id="…"></div>` anchors, `<iframe>`,
  a hand-written switch (`data-learning-mode` in a tag), tabsets on a page
  whose project lacks the `tab-ids.lua` line, and a `.details` without a
  title. A `<details>` and its `<summary>` count once. Code (fenced, or
  indented by four spaces), inline code and HTML comments are not read;
  ` ```{=html} ` blocks are.

The six class names (`reading-step`, `hint`, `solution`, `details`, `embed`,
`modes`) are reserved: a div that already used one changes. Pages without
them render as before; a page with a tabset loads the tab links (`ctm-ui`,
`ctm-nav`), unless `tab-links: false`.

## A site without AI feedback

One source can build a site without AI feedback, for exams or institutions
that do not allow it:

```yaml
# _quarto-no-ai.yml, then: quarto render --profile no-ai
ai-feedback:
  enabled: false
```

or `CTM_FEEDBACK=off quarto render` (other values than `off` and `on` warn).
Any level can turn AI feedback off; no page can turn it back on. Then:

- no Feedback buttons, no settings gear, no ai-feedback scripts or styles;
- exercises that only AI feedback can assess stop the build, unless
  `without-ai` says what becomes of them (below);
- criteria, starters, teaching policies and learning context are not written
  into the HTML; policy files are still checked, so both builds fail alike;
- a page that asked for feedback gets one build message: its exercises that
  only AI feedback can assess, shown as text or removed, then what was left
  out (the exercises and cells whose feedback a component left out, or its
  own `ai-feedback: enabled: true`); a project-wide `enabled: true` is not
  repeated on every page, and pages without AI content stay quiet.

### Exercises that only AI feedback can assess

Some exercises have no static check; without AI feedback they could not be
assessed at all:

- `.ai-feedback` activities (the learner writes, the model gives feedback);
- the components' exercises without a static check, as each component
  decides with its own parser and tells ctm-libs: a math-exercise in
  `mode: custom` without a `checker` (its Check stops with "mode custom
  requires a checker"), where its feedback is on (any `math-exercise:
  feedback:` but `false`), from the math-exercise version that asks.

A py-exercise without tests is not counted: its Check still runs the code
and shows the output, as a pyodide-interaktiv cell with `#| task:` stays
runnable. They count wherever they are on the page, also in tabs, `<details>`
blocks and collapsed callouts; hidden and author-only blocks do not count:
`.hidden`, `hidden`, `aria-hidden="true"`, `display: none` or
`visibility: hidden`, `.example-author-notes`, `.ai-feedback-ignore`, and
generated cell output.

By default a build without AI feedback **stops** at a page that has such
exercises, with one error that names all of them: the page's file (or "a
file it includes": Quarto does not tell which file a block came from), and
each exercise's id or label, or the start of its text. Quarto renders the
pages one by one, so the render stops at the first such page; other pages
may have more. One setting decides for every page, in `_quarto.yml` or the
profile that turns AI feedback off (`_metadata.yml` and a page's front
matter decide for their pages; the nearest wins):

```yaml
# _quarto-no-ai.yml
ai-feedback:
  enabled: false
  without-ai: text
```

- `text`: the question stays, without answer box and Check button, with the
  line "This exercise has no automatic feedback in this version." in the
  exercise's language: an activity's `ui-language`, else
  `ai-feedback: ui-language`, `ctm-assessment: lang` or `lang`; a
  component's own language. The line is in English, German or Bokmål
  (others get English), marked with `lang` where the page's language
  differs. Activities keep their task and source as `.ai-feedback-task`;
  each component shows its own question. The page's build message names the
  exercises.
- `self-check`: the question and a model answer to compare with. Exercises
  have no model answers yet, so for now `self-check` is the same as `text`
  (and later it is `text` for exercises without a model answer); the build
  message says so.
- `drop`: the exercises are removed from the page. The page's build message
  names them and warns that links and cross-references to them no longer
  resolve; headings, callouts and cross-reference blocks around them stay.
  A last resort: the page loses the exercises, and nothing on it says so.
  CTM Assessment never chooses it for you; write it only where the question
  has no value without feedback.

Other values stop both builds (with and without AI feedback) and name the
allowed ones. Builds with AI feedback do not use `without-ai`.

The package lists `ctm-libs-end.lua` after every component: it prints the
page's build message, or raises the error, once every exercise of the page is
known. Where it is not listed (component development builds,
`filters: [ctm-libs]`), the error comes as soon as ctm-libs meets such an
exercise. Where it runs before another CTM filter, a build without AI
feedback stops and names the expected order; a build with AI feedback goes
on as before, with a build warning that names it.

pyodide-interaktiv 1.9 asks ctm-libs itself, in any filter order: without AI
feedback its cells get no Feedback button, gear or adapter, and none of the
AI-only fields (`task`, `feedback-policy`, `feedback-context`, the policy
selection and the learning context); a cell with `#| task:` stays a runnable
cell and does not count as an exercise only AI feedback can assess. The build
message names a page's Pyodide cells only under an explicit
`pyodide: feedback: true` (pyodide-interaktiv's own default is no request, as
math-exercise's `feedback: auto`), once.

Use CTM Assessment or standalone pyodide-interaktiv 1.9 or later for builds
without AI feedback. Older standalone components do not implement the
shared switch; update them instead of relying on filter order.

## Author text, translation and image tasks

````markdown
::: {.ai-feedback #spanish profile="language-quality" response-language="es" feedback-language="en" learner-level="Spanish course 1"}
Write five sentences about your daily routine.

::: {.feedback-starter}
Me llamo Ana. Yo vivir en Oslo.
:::

::: {.feedback-criteria}
Identify up to three useful improvements. Preserve the learner's meaning.
:::
:::
````

The main prose is the learner's task. `.feedback-criteria` is hidden author
instruction; `.feedback-starter` pre-fills the response. Profiles are `review`,
`language-quality`, `translation`, `python` and `mathematics`.

Translation activities can use a nested `.feedback-source` or
`source="original-id"` pointing to a tagged context block. `source-language`,
`response-language` and `feedback-language` are independent. A selected source
remains part of the task even with `context="none"`.

Use `image-upload="true" image-role="response"` for photographed learner work,
or `image-role="source"` for an image to describe. PNG, JPEG and WebP are
supported (at most three images, 8 MiB each, 12 MiB combined). Images remain in
memory. Copy mode requires attaching them separately in the chosen chat app;
direct feedback needs a vision-capable provider. Required images are not silently
dropped. Mathematics may explicitly fall back to its supplied textual graph
summary when a provider cannot accept the optional graph image.

Add `corrections="true"` to opt into one clarification exchange after direct API
feedback on an uploaded response image. The corrected feedback restarts at hint 1;
later hints keep the clarification without reopening the exchange. A new upload
resets corrections and hints and unlocks the answer box, preserving typed text.
Text-only feedback does not lock the box. Changed feedback settings require fresh
feedback before a correction. Without `image-upload="true"`, the build warns and
disables corrections. Copy-prompt mode does not offer the exchange.

## The same learning context in all four integrations

| Setting | Meaning |
|---|---|
| Omitted or `context: auto` | Preceding prose since the latest heading, including that heading |
| `context: none` | No surrounding learning context |
| `context: notes` | Only the tagged block `notes`, anywhere on the page |
| `context: notes,formula` | Those tagged blocks in the specified order |

Text activities use attributes such as `context="notes"`; code cells use
`#| context: notes`. Code integrations also accept `feedback-context` as an
explicit alias; that alias takes precedence.

**Pyodide exception:** `context: interactive`, `setup` and `output` retain their
execution meaning. Use `feedback-context` when specifying both execution and
feedback context. Other context values, including `none`, control feedback and
leave execution at its normal default.

Automatic context is collected once from the source document before exercise
transformation, not by scraping the rendered page. It keeps whole recent blocks
up to 1,500 characters and preserves source LaTeX. Code, other activities,
feedback criteria/starters, `.example-author-notes`, `.ai-feedback-ignore`,
hidden content and generated cell output are excluded. Author callouts remain
visible but are excluded from context. Heading boundaries apply inside nested
containers too; a single oversized latest block is omitted rather than sliced.
A tab of a tabset starts a section as a heading does (nested tabsets too), and
after a tabset its section goes on without the tabs' prose. The content of
`<details>` blocks and collapsed callouts (`collapse="true"`: solutions,
reading steps, hints) is not sent as section prose; blocks an exercise lists
explicitly are still sent, and an exercise inside such a block gets its text.

Explicit context uses a combined 6,000-character budget and preserves math
through MathJax or KaTeX rendering. Missing, duplicate, untagged, empty or
over-budget references are skipped with a browser-console warning. Since 0.9.0
the listed blocks are followed by the prose of the exercise's own section
(since its heading or tab), without context blocks (the listed ones are sent
on their own, the others belong to other exercises), so the task's data in
the prose reaches the feedback too; the 1,500-character cap counts that prose
only.

Reusable tagged blocks can be referenced by any integration. See the
[combined authoring examples](https://github.com/Erasmus-CTM/ctm-assessment/blob/main/docs/reference.md#reuse-one-block-across-different-integrations).

## Prompts, hints and local YAML

Shipped defaults are always available. Loading `policy-files` only registers
named definitions; select a baseline with `policy`, or select
`feedback-policy` on an exercise.

```yaml
# feedback.yml
ai-feedback:
  policies:
    course-feedback:
      base-prompt: Use the terminology taught in this course.
      max-words: 180
      steps:
        - step-prompt: Ask one guiding question.
        - step-prompt: Explain the relevant idea without finished code.
    brief-feedback:
      extends: course-feedback
      max-words: 80
```

```yaml
# Page front matter
ai-feedback:
  policy-files: feedback.yml
  policy: brief-feedback
```

A child inherits omitted fields. A supplied `steps` list replaces the complete
inherited sequence; `steps: []` selects review without hint progression.
`base-prompt` applies throughout, while `step-prompt` adds the current step's
instructions. Step limits and permissions override the policy for that step.

Successful feedback advances one step; the last repeats. Failed, cancelled or
stale requests consume no step. Run/Check resets by default; select a policy
with `reset-on-run: false` to preserve progression. Changing the effective policy
resets saved progress. See the [complete policy guide](feedback-policies.md)
for inheritance, explicit scopes and targeted exercise overrides.

## Provider settings and data sent

Every cogwheel opens the same settings dialog. Copy mode needs no account and
makes no provider request. Direct API mode uses an OpenAI-compatible endpoint,
model and personal key entered in the browser. Institutional defaults belong in
Quarto metadata; never put keys in the project:

```yaml
ai-feedback:
  mode: copy
  storage: local
  base-url: https://your-institution.example/v1
  model: your-model-id
```

Options combine key by key across `_quarto.yml`, the active profiles,
`_quarto.yml.local`, `_metadata.yml` and page front matter ([settings](#settings)).
Unknown options and unsupported values warn and are ignored; a
credential-like key stops the render.

Local storage shares settings across pages on the same origin. Session storage
limits them to a browser tab. Without `storage:` the default is `local`, unless
an integration sets its own default (`pyodide: feedback-storage:`). Users can edit settings and explicitly import old
consumer settings. The chosen provider must allow browser CORS access; network
or VPN requirements remain the institution's responsibility.

Direct requests contain the task, current response, selected context, policy
and optional attachments/evidence. Python tests, expected math answers,
checker source and raw tracebacks are not feedback material. A previous
Check/Run contributes evidence only while it matches the current response;
editing, resetting or rerunning invalidates it. Pyodide sends a generic run
status and learner stdout, not raw stderr, HTML output or plots. Graph adapters
supply an explicit summary and optional image; raw graph/checker objects stay
local. These are client-side learning tools, not secure examination systems.

## Integrating another activity

Use `AIFeedback.attach({integration, id, button, output, getRequest})` for policy,
progression, settings, requests and rendering. `getRequest` should collect data
without executing code. Use `AIFeedback.contextMaterials({mode, refs, text})` for
context and `handle.reset('run')` on Run/Check. Call `handle.cancel({clearOutput:
true})` on edits and `handle.reset()` on explicit Reset. The consumer owns its
editor, checker and evidence boundary. [API reference](api.md).

The Quarto side is `ctm.feedback` ([API](api.md#ctmfeedback)): `markCallout`
(a Callout pass), `prepare(doc)`, `selection(block, options)` and
`context(block, options, isPyodide)`. Components load ctm-libs through their
`ctm-bootstrap.lua`; all policy, context and feedback implementation is here.

### Standalone example

`example.qmd` demonstrates the library with AI feedback activities
(`filters: [ctm-libs]`). The example builds on pushes and pull requests;
download the `standalone-example` Actions artifact. Feedback defaults to copy
mode, which needs no API key.
