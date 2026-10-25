# Similar problems stacked on shared Settings (PR48)

G2 is based directly on ctm-libs PR48 head
`53579c892ccc573879e1cc853601f8f1aa7c1963`. Its package tree therefore includes
PR48's saved-answer Settings panel, quiet saving indicator, compact question
navigation and input-help fix, plus generation policies, both fetched-model
selectors and localized practice controls.

PR46 targets `ui/compact-settings-and-quiz`, so its diff contains the G2 feature
rather than duplicating PR48. AC merges PR48 first. Then retarget PR46 to main,
compare the resulting merged tree to the CI-tested tree, and rebase/update the
branch and rerun CI if it differs. No merge or tag is performed by this work.

The catalogue append conflict was resolved message by message, retaining both
sets and all four UI languages. The AI client and Lua dependency changes combine
without manual conflict resolution. The actual stacked sources pass the Settings/progress/generation/store DOM
suites and Chromium fixture. Actual-page regressions check that saved answers
are inside the shared dialog and practice saves preserve original navigation
credit, including after reload.

Course previews must install the exact stacked G2 head through the normal G4
manifest. A compatibility-only test without publishing the shared Settings panel
is insufficient for reviewing the combined UI.
