# Explicit teaching policies

AI feedback uses `base-prompt` for instructions throughout an activity and
`step-prompt` for the current feedback step. The old `prompt` key is rejected
with a migration message. Fixed shared instructions and authored exercise
criteria remain separate from configurable teaching instructions.

## Load definitions, then select

Loading YAML files registers definitions without activating them. Paths are
relative to the project root (or the standalone document). Files contain an
`ai-feedback` mapping with `policies` and optional `exercises` sections.

```yaml
# feedback.yml
ai-feedback:
  policies:
    guided-practice:
      base-prompt: Preserve the learner's notation and use the course methods.
      max-words: 160
      steps:
        - step-prompt: Ask one guiding question.
        - step-prompt: Explain the relevant idea without finishing the exercise.
    brief-practice:
      extends: guided-practice
      max-words: 80
    worked-review:
      extends: guided-practice
      steps:
        - step-prompt: Give a complete worked explanation.
          allow-full-solution: true
          max-words: 250
```

Two keys, at any level (`_quarto.yml`, a profile, `_quarto.yml.local`, a
`_metadata.yml`, the page's front matter):

| Key | Rule |
|---|---|
| `policy-files` | one path or an ordered list; **adds up** over the levels in that order (project, profiles, `_metadata`, page), each file once |
| `policy` | the selected policy (a name, or a map of integrations to names); **the nearest level wins** |

```yaml
# _quarto.yml
ai-feedback:
  policy-files: feedback.yml
  policy: guided-practice
```

A page can load more definitions and select another policy; the project's
files stay loaded:

```yaml
ai-feedback:
  policy-files: feedback/chapter.yml
  policy: brief-practice      # brief-practice extends guided-practice where the page builds on it
```

Paths are relative to the project root (or the standalone document). A file
name has no special meaning. Loading files never changes a selection. Values
from `metadata-files` or `format: html:` scoped metadata count when no
configuration file or front matter sets the key. No automatic `defaults` or
`integrations` sections are accepted in authored policy files or inline
metadata. The installed `feedback-defaults.yml` is the internal shipped
baseline, not an authored override file.

Until CTM Assessment 0.9 there were four keys. They keep working in 0.9, each
with one build warning:

| Old key | Meaning in 0.9 | Use instead |
|---|---|---|
| `project-policy` | the same selection as `policy` (at one level `policy` wins) | `policy` |
| `page-policy-files` | adds up like `policy-files`, loaded after them | `policy-files` |
| `page-policy` | a second selection applied over `policy`, the nearest wins | `policy`, with a policy that `extends` the project's |

Select a specialization on one exercise with `#| feedback-policy: worked-review`.
For text activities use `feedback-policy="worked-review"` on the `.ai-feedback`
Div. Without a selection, the effective integration baseline remains active.

A selection can instead map integration names to policies:

```yaml
ai-feedback:
  policy-files: feedback.yml
  policy:
    default: guided-practice
    math-exercise: brief-practice
```

The `default` selection applies first, followed by the selected integration.
Supported integration names are `plain-text`, `math-exercise`, `py-exercise` and
`pyodide-interaktiv`. A map's common base instructions and its integration base
instructions are both included; a scalar selection replaces the integration base.

## Inheritance and precedence

Each named policy has at most one parent. Parent definitions may appear before
or after children. Unknown parents and cycles fail rendering, even when the
invalid policy is unused. Definitions with the same name merge field by field
in the order the files are loaded (project first, page last). An omitted parent retains an
earlier declaration; `extends: null` explicitly removes that named-parent link.

A policy with no parent inherits the effective integration settings at its point
of application. A parent chain contributes only its supplied fields; it does not
freeze defaults or discard lower-scope settings. A reusable policy therefore
inherits the appropriate defaults for whichever integration selects it.

Resolution order is:

1. Shipped common/integration defaults and integration runtime options.
2. The `policy` selection(s).
3. The deprecated `page-policy` selection(s), if any.
4. Matching YAML exercise-ID overrides.
5. The exercise's explicitly selected `feedback-policy`, including its ancestry.
6. The current step's settings.

To target a stable authored label without repeating a selection:

```yaml
ai-feedback:
  exercises:
    math-exercise:
      quadratic-practice:
        max-words: 90
```

This applies only to that integration and label; it is not a page-wide override.
Text activities use their explicit Div ID. Code activities use `#| label:`.

## Fields and replacement rules

| Field | Meaning |
|---|---|
| `extends` | One named parent; only inside named policies; null clears parent |
| `base-prompt` | Integration instructions; replaces the inherited base string |
| `language` | Feedback explanation language, independent of UI/response languages |
| `max-words` | Integer 20–2000 |
| `max-issues` | Integer 1–20 |
| `allow-full-solution` | Boolean permission for a full solution; defaults false |
| `reset-on-run` | Whether Run/Check restarts progression; defaults true |
| `steps` | Complete sequence, maximum 20 steps; empty selects review mode |

Omitted values inherit. Scalars replace. Supplying `steps` replaces the whole
list: no appending, padding, or merging corresponding steps. Old per-step
permissions disappear with the replaced list. Each step requires `step-prompt`
and may override `max-words`, `max-issues`, and `allow-full-solution`.

The final request combines fixed shared instructions, authored criteria, the
resolved base instructions, and only the current step's instructions. Replacing
the step list does not replace the base prompt. Explicit text-activity
`max-issues` attributes retain priority over policy limits.

Shipped mathematics has four steps (question, concept, procedure, worked
solution), Pyodide has three hints, and text/Python exercises start in review
mode. The resulting step count is exactly the final list's length. Later
requests repeat the final step. A successful displayed reply or copy prompt
advances progress; failed, cancelled or stale requests do not. Edits preserve
progress. Explicit Reset always restarts it. Changed effective parent settings
reset dependent counters; changing an unused policy does not.

The example policy disclosure shows selected scopes and parent chains plus the
resolved step count, per-step limits/permissions and base instructions. The raw
YAML below is the input definition, not a claim that every displayed policy is
active.

## Migration and maintenance

From the old keys: `project-policy` becomes `policy`; `page-policy-files`
becomes `policy-files` (it adds up with the project's); a `page-policy`
becomes the page's `policy`, and the selected policy `extends` the project's
when the page built on it, so the effective policy stays the same.

Rename policy `prompt` to `base-prompt`, and step `prompt` to `step-prompt`.
Move authored automatic defaults/integration overrides into named policies and
select them explicitly with `policy` (use integration maps when
scope-specific behavior is needed).

After editing shipped defaults run `python scripts/sync-feedback-defaults.py`;
CI checks generated/browser defaults agree with the YAML. Test adapters and
runtime behavior in the CTM Assessment umbrella before adopting changes in
course sites.

## Similar-problem generation

Phase-1 generation uses the same named policy dictionary, parser and inheritance
rules. `ai-feedback: generation-policy:` selects a policy independently of
`policy`; it accepts the same scalar or integration map. Omitted, it uses its
own shipped generation base prompt. A common map such as `{default: practice}`
adds course instructions while retaining the shipped integration prompt. An
exercise can select a specialization with `#| generation-policy: practice`.

Policies may also contain string fields `harder`, `easier` and `same`. Generation
uses the complete resolved common/integration `basePrompts` and the selected
direction; teaching ignores these direction fields. Generation ignores teaching
steps. Both uses share exercise-ID overrides, followed by their respective
explicit exercise policy. Editing direction fields does not reset hint progress.

The exercise can append `#| harder: Give more vectors.` or
`#| simpler: Give fewer vectors.` (`simpler` maps to `easier`), and `#| same:`.
These do not enable generation. Authors opt in with `ai-feedback: similar: true`
or `#| similar: true`; an exercise's false overrides course opt-in. Exam/no-AI
builds keep it off. Prose limits steer generation; trusted authored checks must
also enforce mathematical hard bounds.

Generation client calls use `complete(messages, {generation: true, signal})`:
300 seconds per model call, 16384 output tokens and stripped complete reasoning
blocks before validation, without disabling the reasoning model. Per-call
`timeoutMs` and `maxTokens` override these budgets. Ordinary feedback remains
60 seconds/8192 and rejects reasoning leakage. The time budget applies to each
provider request: a correction retry after a rejected reply starts a fresh
budget instead of inheriting what is left of the first call's. `generator-model` sets a generation model;
learners may override it in Feedback settings. Copy mode cannot generate.
