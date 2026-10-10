# DSX-4 report

All five sections implemented and committed separately; test ledger implemented. Full `pnpm verify` completed green in-turn (exit 0, 2026-10-10 13:58 SGT), with approved filesystem-watcher access. No push; no binaries committed. Browser execution is deliberately deferred under the brief’s “No Playwright” instruction.

| Criterion | Implementation commit | Validation |
|---|---|---|
| §1 Unified media chrome, theme/focus tokens, author/view split | `cd0a5777` | `mediaStyles`, kit config/panel, readonly code tests |
| §2 Language picker, live-only Run, gear Hide/Wrap, no-wrap text scroller, gutter/output tokens | `c592703d` | `codeMedia`, CSS/gutter formula tests; new browser wrap harness |
| §3 Expand/Replace/⋯, shared menus, symmetric handles, edit-time alt, aligned captions | `63af4c97` | Image suite: 28 tests, including submenu sizes, focus, both edges/clamps, readonly captions |
| §4 Caption distinct from alt, nonoverlapping zoom flex row, overlay motion/control sizes | `c59a7039` | Lightbox suite: 16 tests; CSS/order contract; updated browser caption assertion |
| §5 Artifact bar, preserved aliases, lg frame, pill handle, lightbox stacking/motion | `7abd2bed` | Artifact suite: 16 tests; existing resize/read-only assertions retained |
| Verification prerequisite outside media scope: drain scheduled backups before store close | `9d1a2c58` | Backup suites 31 passed; new regression fails on original code and passes with fix |
| Final default image width matches caption after centering | `221cd260` | Image 28 passed; final UI build/typecheck/lint and 2,510 tests passed |
| Final Copy→Run viewing-action order | `86b4efd3` | Post-commit code/media suite: 7 tests pass |
| Cross-section ledger, SDK wrap catalogue, locked-code mutation guard, opt-in media gear styling | `b171d9c3` | Code 3 + media contracts 4; existing chart/input/config suites; browser tests typechecked |

Detailed criterion-by-criterion dispositions and manager reruns: [_test-ledger.md](_test-ledger.md).

Verification: `pnpm --filter open-book run verify` exited **0**. Builds, generated-source checks, all workspace typechecks/lint and available tests passed: **SDK 580, UI 2,510, app 9, server 1,441** (8 pre-existing server skips), plus MCP script tests. Protocol e2e passed **256 server checks + 70 MCP checks**. The script uses explicit sdk/ui/mcp/server build targets and server/MCP e2e targets; it does not run web Playwright or a native desktop build. CSS warnings shrink **162→148**, zero errors. `assert-spacing-stylelint.mjs` is untouched. No existing test was weakened beyond the brief’s intentional behavior changes.

Environment/prerequisite evidence: macOS filesystem watchers raised EMFILE inside the sandbox; the identical mirror suite passed 3/3 with approved access outside it. No test suppression or watcher-related code change was needed. Full verification also exposed an independent ENOTEMPTY/PGlite-closed backup teardown race. `9d1a2c58` drains active scheduled backups before store close; its regression fails on the original implementation and passes with the fix, and both backup suites pass 31 tests.

Final-source validation: the Copy→Run correction passed the code/media suite (7 tests). The final frame/caption width correction `221cd260` landed during workspace verification’s server phase, so the final UI source received an additional **full UI build, typecheck, lint and all 2,510 tests (253 files)**, all green. Frame and caption widths are asserted equal for default and every preset. No implementation changes followed those checks.

Visual captures: code hover bar/language picker/settings and long horizontal line; image bar/dropdown/two handles, centred partial-width frame and matching left-aligned caption, empty-caption hover/focus reveal; lightbox distinct caption above zoom controls at short/tall viewports; artifact bar, lg corners, bottom pill and overlay stack. Capture light/dark, hovered/selected/focused/open menu, read-only/present/viewer, nested rows and touch selection.

Manifest gaps: **G-b resolved locally without fallback**: built `packages/ui/dist/style.css` emits `--height-control-md:32px` and `--height-control-lg:36px`; lightbox uses these aliases. **G-c remains open**: stage scrim/white-alpha inks unchanged as instructed; manifest owner must supply stage tokens or an exemption. Chrome/focus declarations follow §8.1 exactly, using existing dark-aware semantic aliases. No invented stage tokens. Warn-only baseline comments record reduction; there is no enumerated baseline file to prune.

Wrap risk: **browser gate remains required**. Units prove highlighted offset mapping, native-key pass-through, selection preservation, unchanged editor node and snapshot persistence; happy-dom cannot prove native caret auto-scroll, glyph geometry, pointer-drag selection, IME, bidi/grapheme navigation, browser scrollbar behavior or actual pixel stability. The added harness covers real Home/End, Shift+Home, scrolled caret visibility, and stable block/toolbar positions. Wrapping naturally changes content height; toggling back must restore it. Manager should run Chromium/WebKit, narrow columns, nested/locked groups, 300+ character lines, keyboard and drag selections, and OS-specific Home/End equivalents. Gutter math at 16px base: line centre = 4 + 1 + (24 + 8) + 21/2 = 47.5px; button centre = 35.5 + 12 = 47.5px. Existing glyph-centre e2e remains logically valid and unmodified.

Scope flag: `9d1a2c58` is a small server lifecycle fix beyond the media brief, required by verification. Shutdown now waits for in-flight scheduled backups; code review should include that change and its regression. No existing assertion was relaxed.

Proposed gates: **design + code**. Design owns the listed visual captures and G-c disposition; code owns manager browser reruns and wrap navigation/selection checks before merge. No push performed. Input `_brief.md` remains untracked and untouched. Git commit hooks completed; Git printed a nonfatal sandbox warning about `packed-refs.lock`, but every listed commit exists.
