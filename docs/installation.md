# Installation and setup

[Start here](../README.md) · [Reference](reference.md) · [API](api.md)

## Course authors: install CTM Assessment

ctm-libs is the internal library of CTM Assessment and is installed with it.
Authors install and list only the package:

```sh
quarto add https://erasmus-ctm.github.io/ctm-assessment/ctm-assessment.tar.gz
```

```yaml
filters: [ctm-assessment]
```

The package brings ctm-libs, ctm-checkers, JSXGraph, math-exercise, ctm-stack,
py-exercise and pyodide-interaktiv, in one version. Use Quarto 1.8.27 or later. A component
found without the package stops the render with this install command.

AI feedback activities (`.ai-feedback` blocks), their settings (`ai-feedback:`)
and the teaching policies work as before; see the [reference](reference.md).

## Projects set up for ai-feedback

The renamed repository now installs ctm-libs only. Install CTM Assessment
with the command above and use `filters: [ctm-assessment]`.
On a fresh installation, `filters: [ai-feedback]` fails with Quarto's
extension-not-found error.

Quarto does not remove folders left by earlier installations. Remove
`ai-feedback` from `filters:` and delete its old folder. Listing a stale
standalone ai-feedback 0.8.1 next to CTM Assessment stops the page with a
migration message, because a page must use one feedback implementation.

For standalone pyodide-interaktiv, install 1.9 or later as described below.
It ships its own generated forwarder for projects set up for 1.8.

## pyodide-interaktiv on its own

pyodide-interaktiv also installs without the package (decision 5). Its current
version is on the branch `feature/shared-feedback-integration`; the
repository's default branch still holds 1.6, without ctm-libs, so name the
branch:

```sh
quarto add Erasmus-CTM/pyodide-interaktiv@feature/shared-feedback-integration
```

writes `_extensions/Erasmus-CTM/pyodide-interaktiv`, a copy of ctm-libs
(`_extensions/Erasmus-CTM/ctm-libs`, generated from a ctm-libs commit and
checked in its CI) and, from 1.9, an `ai-feedback` forwarder that replaces the
ai-feedback 0.8.1 folder of 1.8 projects (`filters: [ai-feedback]` keeps
working with one warning). The component calls the bootstrap with
`{standalone = "quarto add Erasmus-CTM/pyodide-interaktiv@feature/shared-feedback-integration"}`: without the
package it uses the ctm-libs next to it, and when that is missing or too old
the render names this command. Projects that commit `_extensions/`, or that
allow only `_extensions/Erasmus-CTM/pyodide-interaktiv` in `.gitignore`, add
`ctm-libs` too. In the package, the package's ctm-libs serves every
component, and a page that would combine two ctm-libs versions stops.

## Component development

Component repositories build and test against a ctm-libs installation without
the package. Install ctm-libs into the component's project and tell the
component's bootstrap that this is a development build:

```sh
quarto add Erasmus-CTM/ctm-libs@main --no-prompt     # or a checkout: quarto add ../ctm-libs --no-prompt
CTM_COMPONENT_DEV=1 quarto render
```

Without `CTM_COMPONENT_DEV=1`, a component stops when the CTM Assessment
package is missing. Tests that load ctm-libs' browser files read their
location from `CTM_LIBS_EXTENSION` (the `_extensions/ctm-libs` folder).

## A site without AI feedback

`ai-feedback: enabled: false` in a profile (`quarto render --profile no-ai`)
or `CTM_FEEDBACK=off quarto render` builds the same source without any AI
feedback: [details](reference.md#a-site-without-ai-feedback). A page with
exercises that only AI feedback can assess stops that build until
`ai-feedback: without-ai:` says what becomes of them (`text`, for example):
[details](reference.md#exercises-that-only-ai-feedback-can-assess).

## Provider settings and data sent

Every cogwheel opens the same settings dialog. Copy mode needs no account and
makes no provider request. Direct API mode uses an OpenAI-compatible endpoint,
model and personal key entered in the browser. Institutional defaults belong in
Quarto metadata; never put keys in the project (a key there stops the render):

```yaml
ai-feedback:
  mode: copy
  storage: local
  base-url: https://your-institution.example/v1
  model: your-model-id
```

These settings combine key by key across `_quarto.yml`, the active profiles
(with several profiles the first listed wins, as in Quarto),
`_quarto.yml.local`, directory `_metadata.yml` files and page front matter,
so a page that selects a `policy` keeps the project's `mode`, `base-url`,
`model` and `storage`. A value in the page's own front matter wins; values that
only Quarto's merged metadata contains (notebook front matter, `format: html:`
scoped settings, `metadata-files`) are used too. Rendering warns about
unknown options (for example `base_url`) and unsupported `mode`/`storage`
values, and about an invalid `base-url` without repeating it.

Local storage shares settings across pages on the same origin; "Remember on
this device" is the default. Session storage limits them to a browser tab.
Without `storage:` the default is `local`, unless an integration sets its own
default (`pyodide: feedback-storage:`). Users can edit settings and explicitly
import old consumer settings. The chosen provider must allow browser CORS
access; network or VPN requirements remain the institution's responsibility.

Direct requests contain the task, current response, selected context, policy
and optional attachments/evidence. Python tests, expected math answers,
checker source and raw tracebacks are not feedback material. A previous
Check/Run contributes evidence only while it matches the current response;
editing, resetting or rerunning invalidates it. Pyodide sends a generic run
status and learner stdout, not raw stderr, HTML output or plots. Graph adapters
supply an explicit summary and optional image; raw graph/checker objects stay
local. These are client-side learning tools, not secure examination systems.
