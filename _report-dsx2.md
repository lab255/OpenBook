DSX-2 implemented in seven incremental conventional commits, plus one separately committed verification-blocking server shutdown repair; no push. `pnpm verify` completed green in the foreground in this turn (exit 0, 2026-10-10). One requested visual delta is intentionally withheld because the brief gives existing tests precedence: legacy danger-callout export keeps 🛑.

| Criterion | Commit | Delta and verification |
|---|---|---|
| 1 Todo | `233c08b8` | Native accessible checkbox wrapped with theme-painted box/tick; checked/disabled/focus behavior retained, accent-color removed. Manifest §3 records compact checkbox radius exception. Existing read-only/group-lock suites: 6 passed; added todo toggle/read-only tests in section 4. |
| 2 Lists | `09d3aa45` | Per-indent counters skip deeper lists, including bullets; decimal/alpha/Roman cycle; CSS disc/ring/square markers; inherited ink and token minimum width. `listMarkers.test.ts`: 15 passed. Export list flattening untouched. |
| 3 Quote | `39fd7b6f` | Rail inherits currentColor; 12px gap retained. Diff/CSS lint checked; visual gate remains manager-owned. |
| 4 Callout | `5433617f` | Shared emoji/Lucide picker persists icon without changing variant; read-only PageIcon; 16/16/16/12 padding and aligned lead offset; explicit bg paints one surface. Export carries icon/bg, escapes custom emoji/text, falls back for Lucide, and mirrors nine light tints. `textBlockFamily`, `export`, `foundationTokens`: 40 passed, including 9 tint-equality cases. |
| 5 Notes | `0bcce17c` | Small/caption typography and leading tokens, 12px label icon, 0.04em tracking, family-specific lead metrics. Existing presentation/gutter suites: 20 passed. |
| 6 Placeholders | `0301b5e3` | List/todo/quote/callout/notes hints require focus; presenter-note hint added; heading/code/sole-paragraph and read-only behavior preserved. Placeholder/compact/read-only suites: 11 passed. |
| 7 Shortcuts | `34a1c54f` | Third dash in an otherwise-empty paragraph creates divider + following focused paragraph; quote alias added; > retained with DSX-10 comment; numeric N. supported. Shortcut/trigger/slash suites: 18 passed, including nonparagraph, trailing-content and selection guards. |

Verification repair outside the UI scope: `ad7ef57f` drains already-running scheduled backup checks before closing the store. The full gate exposed a reproducible teardown race (ENOTEMPTY / PGlite closed), and the isolated original test also failed. Added an in-flight-export shutdown regression without changing existing assertions; `backupBoot.test.ts` + `backups.test.ts`: 31 passed.

Manifest gap closed: §1.1 documents `--obe-icon-size = calc(var(--obe-font-size) * 1.25)` (20px). Declared in @theme and rebound alongside derived editor/presentation sizes so scaling resolves correctly. No new lint exception or baseline increase; no guard weakened.

Test conflict: existing `packages/ui/src/export/__tests__/export.test.ts` “stored callout variants” explicitly requires danger’s 🛑 pseudo-icon. Preserved unchanged per brief, so default danger icon remains different between editor (🚫) and export (🛑). Explicit emoji export works. Existing export 12px padding is also retained; the requested 16/16/16/12 change applies to the editor.

Verification: **`pnpm verify` GREEN, exit 0**, final full foreground run outside the sandbox on committed implementation + shutdown repair. Build, generated-file freshness, workspace typechecks, lint and ESLint/stylelint rule tests passed. SDK: 32 files / 580 tests; UI: 255 files / 2,548 tests; app: 3 files / 9 tests; server: 106 files / 1,441 tests passed, with the existing 1 file / 8 tests skipped. MCP package checks passed; server end-to-end: 256 checks; MCP end-to-end: 70 checks. Full log: `/tmp/dsx2-verify-final.log`.

Verification history: Attempt 1 (sandbox) passed build/typecheck/lint, SDK/app/UI tests (UI: 255 files / 2,548 tests), and MCP checks, then reported a failure in the unchanged server disk-mirror integration suite; its 3 tests passed outside the sandbox (7.56s), and the already-failed run was stopped. Attempt 2 (outside sandbox) passed the mirror test and 105 server files / 1,439 server tests, but failed scheduled-backup teardown with ENOTEMPTY; 1 file / 8 tests were skipped by existing configuration. The isolated backup test reproduced the race, leading to the separate repair above. No tests, timeouts, skips or lint severities were weakened.

Proposed gates: **code + design**. Manager captures should target todo (light/dark, checked/unchecked/disabled/focus), nested numbered/bullet lists and inherited ink, quote ink, callout (legacy/default vs explicit emoji/Lucide and all bg choices), notes, focused/unfocused placeholders, and divider insertion/caret flow. No Playwright or before/after captures run here, per brief; the root verification uses server/MCP integration scripts, not browser Playwright. No binaries committed; no changes to menus, gutter chrome, or unrelated block families. `_brief.md` is the supplied untracked input and remains uncommitted.

## Pre-endorsed fix round — OB-967 (2026-10-10)

All six fixes completed in this commit (`fix(ui): apply DSX-2 review fixes`); no push.

| Fix | Outcome |
|---|---|
| 1 | Callout cursor/hover scoped to the button; neutral foreground/0.06 overlay; transition retained. |
| 2 | Explicit todo focus-visible 2px ring with 2px offset. |
| 3 | Existing numbered-marker class right-aligned with 0.25rem inline-end padding and nowrap; bullets stay centred. |
| 4 | Depth-2 square bullet sized to 0.3125 × font size (5px), with margin recentred at half-size (0.15625). |
| 5 | Manifest §3 records checked tick `--primary-foreground`, not white, for dark-mode contrast. |
| 6 | `_report.md` renamed with `git mv` to `_report-dsx2.md`; this outcome appended. |

No tests pin the changed CSS literals; no assertion updates were necessary, and no assertions were removed or weakened. No renderer change was needed because `obe-list-number` already exists. Visual review targets: callout button hover/read-only icon, todo focus, numbered markers, depth-2 square bullets.

**`pnpm verify` GREEN, exit 0, foreground in-turn outside the sandbox.** Build, generated-file freshness, typecheck, lint, CSS controls, and 7 ESLint-rule tests passed. SDK: 32 files / 580 tests; UI: 255 / 2,548; app: 3 / 9; server: 106 / 1,441, with the existing 1 file / 8 tests skipped. Total: 396 files / 4,578 tests passed. MCP package checks passed; server end-to-end: 256 checks; MCP end-to-end: 70 checks. Log: `/tmp/dsx2-fix-verify-final.log`.

First sandbox run failed in unchanged `mirror.integration.test.ts` with filesystem-watcher `EMFILE` errors (105 server files / 1,440 tests passed). The unchanged mirror suite passed outside the sandbox (1 file / 3 tests), followed by the full green rerun above. No unrelated repair or test change was needed. Supplied `_brief.md` and `_fixbrief.md` remain untracked.
