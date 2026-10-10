# DSX-7 fix round — Quinn's PRE-ENDORSED fixes (A, B + nits C, D)

Branch `feat/dsx-7-block-chrome`, worktree /Users/eliot/Workspaces/OpenBook-wt-dsx7 (HEAD 0ec29b68). Exact shapes; refs at 0ec29b68.

## A (HIGH) — selection wash veils text (2.6:1)
index.css:241: `--obe-select-wash: hsl(var(--ring) / 0.14);` and the dark-theme pair at 0.2 (this IS the manifest/audit contract — the 0.55 accent was the old background value, wrong for an on-top overlay). Add e2e assertion: after selecting, `getComputedStyle(row,'::before').backgroundColor` alpha ≤ 0.2.

## B (MED) — hover bridge across the 4px clearance
After the `.obe-gutter` rule:
```css
/* Hover bridge across --obe-gutter-clear; inherits the gutter's pointer-events, so inert while hidden. */
.obe-gutter::after { content: ''; position: absolute; inset-block: 0; left: 100%; width: var(--obe-gutter-clear); }
```
Add e2e: `page.mouse.move(textLeft+2 → handleCenter, {steps: 20})` then handle opacity 1 — top-level AND nested.

## C (NIT, apply) — notes joins the text family
Add `[data-block-type='notes']` to both selectors at index.css:901 and :904 (notes renders TextBlockView; click-in-pad must place the caret like its siblings).

## D (NIT, apply) — lock the WCAG gap floor
gutterStyles.test.ts rhythm block: `expect(CSS).toMatch(/--obe-gutter-gap:\s*4px/); expect(CSS).toMatch(/--obe-gutter-clear:\s*4px/);`

## Validate + commit
Foreground: gutterStyles unit tests + the DSX-7 browser suites touched (block-editor, block-gutter-captures + the two new e2e assertions) + ui typecheck/lint/stylelint. One conventional commit, NO push, no brief/report files. Report `_report-dsx7-fixes.md`: per-fix line + results. Terse.
