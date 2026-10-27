# ctm-libs: the internal library of CTM Assessment

ctm-libs holds what the components of [CTM Assessment](https://github.com/Erasmus-CTM/ctm-assessment)
share: their settings, their languages, the Python runtime of the page, the
page's interface and AI feedback (formerly the ai-feedback extension). It is bundled with CTM
Assessment, and course authors never install or list it themselves:

```sh
quarto add https://erasmus-ctm.github.io/ctm-assessment/ctm-assessment.tar.gz
```

```yaml
filters: [ctm-assessment]
```

[Installation and setup](docs/installation.md) · [Reference](docs/reference.md) ·
[API for components](docs/api.md) · [Development](docs/development.md) ·
[Changes](CHANGELOG.md)

## What it provides

- **Settings, key by key.** One reader for every CTM section (`ai-feedback`,
  `ctm-assessment`, `math-exercise`, `py-exercise`, `pyodide`) across `_quarto.yml`,
  profiles, `_quarto.yml.local`, `_metadata.yml` and the page, so a page that
  sets one option keeps the project's other options. Credentials in the
  metadata stop the render.
- **Languages.** One resolver and one message catalogue for every component:
  English, German and Norwegian Bokmål (and Spanish for the feedback
  interface, Swedish and Danish for pyodide-interaktiv), with
  `ctm-assessment: lang` for all components at once.
- **The Python runtime** of the page (Pyodide), loaded once whatever the mix
  of components, with Stop for long checks; and the Python worker
  (`CTMWorker`, moved from pyodide-interaktiv) with `input()`, Stop by
  interrupt, and extra packages that load without getting in a check's way.
- **AI feedback.** Text, translation and image activities (`.ai-feedback`),
  feedback for the exercises of every component, teaching policies, and a
  build switch for sites without AI feedback (`ai-feedback: enabled: false`,
  with `without-ai:` for exercises that only AI feedback can assess).
- **The page's interface, in Markdown.** Reveals (`.reading-step`, `.hint`,
  `.solution`, `.details`), the lecture/reading switch, embedded pages, and
  links into tabs and reveals that open, scroll to and focus their target.
- **Cacheable files.** Every browser file is an HTML dependency, loaded once
  per page.

Components load the library through a small file they all copy,
[`bootstrap/ctm-bootstrap.lua`](bootstrap/ctm-bootstrap.lua).
pyodide-interaktiv also installs on its own, with a generated copy of
ctm-libs ([details](docs/installation.md#pyodide-interaktiv-on-its-own)).

## Formerly ai-feedback

This repository was Erasmus-CTM/ai-feedback; GitHub redirects the old name.
It installs ctm-libs only: the `ai-feedback` extension alias was removed, so
`filters: [ai-feedback]` no longer works on a fresh installation. Install CTM
Assessment and list `ctm-assessment`.
[Details](docs/installation.md#projects-set-up-for-ai-feedback).

[Example source](example.qmd): AI feedback activities with the library alone
(`filters: [ctm-libs]`), built on every push as the `standalone-example`
artifact. The authoring guides for activities are [here](docs/authoring.md).

## License

AGPL-3.0-or-later. See [LICENSE](LICENSE).

Developed by the **CTM team** for the Erasmus+ project
**“Computational Thinking makes sense of Mathematics”**
(**2023-1-NO01-KA220-HED-000166744**).
[Funding and acknowledgements](docs/acknowledgements.md).
