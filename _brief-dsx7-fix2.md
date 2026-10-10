# DSX-7 fix round 2 — Devon's heading-wash blocker (one fix)

Branch `feat/dsx-7-block-chrome`, worktree /Users/eliot/Workspaces/OpenBook-wt-dsx7 (HEAD 17dd30c5).

## Fix (HIGH)
index.css `.obe-row-selected::before` (~:949): the two-value `inset` applies `--obe-row-space-above` to top AND bottom, collapsing a selected heading's wash to a sliver. Change to the three-value form:
`inset: var(--obe-row-space-above, 0px) calc(-1 * var(--obe-block-bleed)) 0;`

## Test
Add an e2e assertion (block-editor.spec.ts, near the existing selection-geometry tests): select an H1 (and ideally H2/H3) → the `::before` wash height ≥ the heading's line box height.

## Validate + commit
Foreground: gutterStyles unit tests + the selection-related browser tests incl. the new assertion + ui typecheck/lint. One conventional commit, NO push, no brief/report files. Report `_report-dsx7-fix2.md`: one line + results. Terse.
