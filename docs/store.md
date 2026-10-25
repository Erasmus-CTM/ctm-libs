# Saved answers and copy API (phase B foundation)

CTM stores answers only in the learner's browser. Saving defaults to `answers`; use `ctm-assessment: {save: none}`, a component's `save: none`, or `#| save: false` for shared computers. There is no expiry. The page toolbar has a cogwheel opening shared Settings, with separate Answers & storage and AI feedback sections. A quiet saving-status button opens the storage section directly. Page and course deletion require confirmation inside Settings; export remains available there. Turning saving off deletes the course's answers and learner seed; turning it on enables future saving. The seed is a random browser-only identifier, kept in session storage when saving is off.

Components require API level 3. After parsing a block, call
`ctm.ui.exercise{component, id, source, save}`. The source is the first 16 hex digits of SHA-1 of the block text. Leave save nil to inherit metadata. The return is `{save, attributes}`; apply the returned `data-ctm-*` attributes to the exercise container. Add `ctm.progress.prepare(doc)` before component CodeBlocks for standalone quiz scopes, and `ctm.ui.finalize(doc)` in the final standalone Pandoc pass. The umbrella's end filter finalizes after all components.

`CTMStore.register({component,id,element,source,save,variant,variants,seen,read,write,clear,legacy,exportItem})` returns `{restore,changed,result,clear}`.
- read() returns the component-owned inputs object; null means starter/empty and deletes its record.
- write(inputs,meta) fills only exact source/hash matches. Suppress synthetic editor change events during write and clear. Restore never runs Python or checks an answer.
- variant() returns the current {n,id,hash}; variants() returns deployed descriptors, defaulting to the current descriptor. Matching hash restores exactly; matching n, then id, returns changed; no match returns withdrawn.
- restore() synchronously returns {state,record?,variant?,outdated?}; states are empty, disabled, restored, changed, withdrawn. Changed/withdrawn old answers belong in a read-only view.
- changed() emits `ctm:answer-change` without reading the adapter immediately, then schedules a 250 ms save. The deferred read refines the answered/empty state; clear() cancels it, deletes the record and calls the adapter clear callback.
- result({score,status,variant?}) emits ctm:result. Score is 0–1; status is correct, partial, wrong or invalid. Invalid does not update saved progress.
- By default the result event's `variant` remains the identity descriptor (or the explicit result override), preserving existing adapters. Shared chooser adapters may explicitly register `numberedVariantResults: true`: the event then carries `variant: n` and a separate `variantIdentity: {n,id,hash}`. Unnumbered proposals emit both fields as `null`, never zero. This only changes the public event projection; P17 continues storing the complete approved identity and any proposal sidecar. Progress still consumes status/score and the exercise identity.
- legacy is an array of {read,remove?}; read returns {inputs,keys?} or null. Legacy inputs:null deletes an old starter record. A durable shared write precedes deleting legacy keys. A legacy record wins an existing new record. Disabled saving never reads or removes legacy data.
- exportItem() returns {title,parts:[{kind:'answer'|'code'|'output'|'image',label,text|dataURL}]}. It reads live page state, including code/output, without running it.

Global methods: enabled(), setEnabled(bool), clearPage(), clearCourse(), seed(), key(id), exportItems(); course and page are canonical read-only properties. Records are UTF-8 JSON, at most 64 KiB, under encoded versioned course/page keys. Future record versions are preserved during cleanup and writes. Storage exceptions fall back to page memory with one message; legacy keys are retained if the durable save failed.

`CTMCopy.text(text,{label})` returns a promise with method clipboard, execCommand or select. The shared helper owns copy status and a selectable dialog fallback, with Ctrl+C or ⌘C. Export adapters and copy buttons remain available when saving is off.

Progress navigation uses number-only tiles outside the exercise flow. Wide pages use the right margin alongside the existing table of contents; narrow pages expose a grid-icon button opening a modal question picker. Credit fills each tile from the bottom in proportion to its score. A dot marks an ungraded answer, a cross marks zero credit, a dashed border marks an outdated result, and an independent outline marks the current question. Outdated credit is excluded from current totals. Editing removes previous credit until the answer is checked again. Titles, totals, localized status and exact credit remain available to screen readers without visible labels. Forced-color mode adds partial/full-credit symbols, and touch tiles are 44 px. Both dialogs use native modal keyboard handling, Escape dismissal and focus restoration.

Focused DOM and Quarto render tests cover identities, restoration, credit and shared dependencies. `tests/browser/compact-ui.mjs` checks settings integration, export focus, desktop/mobile placement, keyboard navigation, touch targets, forced colors and print in Chromium; set `AXE_MODULE` to an installed axe-core script to include accessibility checks. It exercises UI adapters without starting Python or checking mathematical correctness.

Adapters may register `hasAnswer(inputs)` to distinguish learner responses from
auxiliary data stored in their record. `flush({notify: false})` persists such data
without emitting `ctm:answer-change` or changing the current result. Ordinary
`changed()` and `flush()` retain their normal invalidation/notification behavior.
Generated practice uses these options so its saved work never changes the
original exercise's navigation credit or answered marker.
