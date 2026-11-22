# DSX-7 — Block-chrome implementation: handle, selection overlay, padding/rhythm, margins

Worker on branch `feat/dsx-7-block-chrome` (STACKED on feat/dsx-1-foundation-tokens @ d0eca355, which stacks on design/dsx-0-manifest; merge order #384 → DSX-1 → this; merge, never rebase). Worktree /Users/eliot/Workspaces/OpenBook-wt-dsx7. Scope: packages/ui + packages/web e2e updates + BlockPageDocument.tsx.

This implements the owner-approved DSX-7 audit (2026-10-08) + owner decisions (2026-10-09): HIDE chrome while typing · pad-y 4px (32px pitch) · symmetric 90/90 full-width margins. The DSX-1 foundation tokens (--motion-*, --radius-*, --obe-line etc.) exist on this branch — use them.

## Token additions (declare in :root, per audit §8.1)
`--obe-gutter-btn: 24px` · `--obe-handle-w: 18px` · `--obe-gutter-gap: 4px` (comment: FLOOR 4px — WCAG 2.5.8 spacing exception for the 18px handle depends on it) · `--obe-gutter-clear: 4px` · `--obe-gutter-room: calc(btn+gap+handle+clear)` (=50px) · `--obe-block-pad-y: 4px` · `--obe-block-bleed: 4px` · `--obe-row-space-above` (per family; headings = their --obe-hN-space; first root row 0) · `--obe-select-radius` (default var(--radius-sm); lg-surface families — callout, code, image, htmlArtifact, group, KitFrame blocks — var(--radius-xl)) · `--obe-columns-gap: 28px`.

## Changes (audit hit list; file:lines measured at main 190c5504 — RE-LOCATE on this branch, DSX-1 moved things; existing code wins on mechanism, the audit wins on geometry)
1. **Selection → overlay** (replaces index.css ~:983-986): delete ring box-shadow + row background + row border-radius (~:980). New `.obe-row-selected::before`: `position:absolute; inset: var(--obe-row-space-above, 0px) calc(-1 * var(--obe-block-bleed)); background: var(--obe-select-wash); border-radius: var(--obe-select-radius, var(--radius-sm)); z-index: var(--z-index-drop-indicator); pointer-events: none`. NO layout change on select. Adjacent selected rows abut into one slab.
2. **Handle 18×24** (~:1078-1092): `+` stays 24×24; gap/clear 4; gutter left `calc(-1 * var(--obe-gutter-room))`; hit box = visual box (no pseudo expansion); radius md; ink alpha 0.7→0.8 (`--obe-chrome-ink` if DSX-1 lacks one).
3. **Padding** (~:976-982, :1127-1131): text families (paragraph/heading/list/todo/quote) → `padding-block: var(--obe-block-pad-y)` ON `.obe-text` (click-to-caret preserved; marquee exclusion unaffected); ALL other rows → on `.obe-row`. 
4. **Margins rule**: block roots carry NO vertical margin — zero out (~:1267 image, :1562 artifact, :1888 group, :2461 dbview, :3259 kit chart, :3709 kit container; re-locate). Divider `margin-block: calc(var(--obe-line)/2)`. Headings: `margin-top` on .obe-text (~:1143-1145) MOVES to row `--obe-row-space-above` + `padding-top` (drop-targeting stays; overlay starts below it). Stacked-columns gap (~:3910) → 0.
5. **Per-type gutter tops** (~:1063-1071): DELETE; replace with the formula `top = lead-offset + (lead-line − 24px)/2`; families declare `--obe-lead-offset` (text: `calc(var(--obe-row-space-above,0px) + var(--obe-block-pad-y))`; surfaces: pad + own inner offset) and `--obe-lead-line`. Resolved targets to verify: para 4 · h1 43.5 · h2 31.6 · h3 21 · callout 16.
6. **Reveal** (~:1072-1077): innermost-only `.obe-row:hover:not(:has(.obe-row:hover)) > .obe-gutter`; DROP row `:focus-within` reveal (owner: hide while typing); KEEP `.obe-gutter:focus-within` + the `:has(.obe-gutter-btn:focus-visible)` pin (~:2454) — keyboard access unchanged.
7. **Nested + narrow variants** (~:1037-1040, :1054-1056): both `left: calc(-1 * (var(--obe-handle-w) + var(--obe-gutter-clear)))` (−22px); narrow threshold → `52.25rem`; `--obe-columns-gap: 28px` (~:1877) + column divider left/right re-derived (~:3880-3907).
8. **Chrome line unification**: tint bleed (~:2290-2294) margin/padding-inline via `--obe-block-bleed` (−4/4, was −8/8); drop indicators (~:1109-1116) left/right `calc(-1 * var(--obe-block-bleed))`.
9. **Side-drop zone** BlockEditor.tsx computeRegion (~:567-574): `side = Math.min(48, rect.width * 0.18)`.
10. **Full-width margins** BlockPageDocument.tsx (~:592): `pl-[…]` → `px-[var(--obe-gutter-room)]`.
11. **Todo/list alignment** (~:1173-1190): todo box 1rem square, `margin: calc(var(--obe-block-pad-y) + (var(--obe-line) - 1rem)/2) 4px 0 4px`; list marker `padding-top: var(--obe-block-pad-y)`.
12. **Table reserves** (~:1938, :2008-2022): wrap padding → `0 0 16px 0`; add-col control absolutely positioned overflowing `right: -16px` into the page margin.
13. **Keyboard focus** on chrome: outline 2px ring offset 2 (reaches exactly x=0, never overlapping text).

## Tests
- `gutterStyles.test.ts` pins old literals/selectors (~:26-129 + col-divider) — UPDATE assertions to tokens/new values, delete NOTHING; ADD: overlay ::before present + no box-shadow on .obe-row-selected; handle width token; text-family padding-block.
- e2e re-run REQUIRED (adjacent-selector rule): `block-editor.spec.ts` (drags :188/:210/:222/:1218, marquee :1105-1210, selection counts), `table-grips.spec.ts:105-153`, `block-gutter-captures.spec.ts` (BB-6 overrides hard-code -3.4rem/-1.6rem — update), `context-suppression.spec.ts`, `viewer-readonly.spec.ts`. Never pointer-events:none a draggable.
- `pnpm verify` FOREGROUND green.

## Acceptance
Each owner complaint measurably fixed: handle hit 576→432px²; selection never overlaps text/neighbours/surface padding (overlay geometry); pitch 32px; single margin system (padding-only) + symmetric full-width; todo/list text-start aligned at 24+pad. No existing test deleted/weakened. Conventional commits, NO push, no brief/report files committed. Report `_report-dsx7.md`: outcome first, per-change commit map, resolved-geometry verification table (measured vs audit targets), e2e results, open questions. Terse.
