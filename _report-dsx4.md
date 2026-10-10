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

## Review round — B1/B2/Q1/Q2/Q3

All five review items implemented in four conventional commits, without push. This appendix supersedes the earlier native-key pass-through claim and server lifecycle scope flag. Browser confirmation remains manager-owned; no Chromium/Playwright was launched.

| Item | Commit | Change and evidence |
| --- | --- | --- |
| B1: no-wrap caret navigation/scroll | `bd9f4985` | Explicit no-wrap code Home/End logical-line movement; Ctrl/Meta reaches document endpoints; Shift preserves anchor and direction across highlight spans. Scroll the code area to the focus endpoint using its caret rectangle. Wrapped code retains native visual-line behavior. `codeMedia.test.tsx`: 4 passing tests; strengthened navigation and multiline regressions failed before the fix (2 failed/2 passed). Existing mapping, selection, persistence and node-identity assertions retained; key-consumption expectation intentionally changes to false. |
| B2: initial fit equals Reset | `1962003b` | Reserve the zoom row from first open with visibility hidden until measurement is ready; caption and zoom rows occupy the same space during initial fit and Reset. Layout-sensitive regression reproduced 53% before insertion versus 49% after; now initial/reset both 49%, with double-click reaching 100%. `imageLightbox.test.tsx`: 17 passing tests; new regression failed against old code. |
| Q1: revert duplicate backup drain | `bde84a66` | Reverts `9d1a2c58` using `git revert --no-commit`, with a conventional commit title. `server.ts:691` is plain `backups.stop();` with no await. The associated new drain regression was removed as part of the expressly requested full revert; PR #391 owns the safer replacement. |
| Q2: no dead locked language chip | `a2127b8e` | Read-only branch renders no language chip; existing locked-action assertions preserved and DOM-absence assertion added. |
| Q3: bounded language label | `a2127b8e` | Exact requested `.obe-code-lang` max-width 12rem, overflow hidden, ellipsis, nowrap declarations. |

Focused verification: 21/21 tests across the two affected suites. Full foreground verification finished successfully; final counts are recorded below.

Manifest flags unchanged: G-b aliases available (32px/36px), no literal fallback; G-c stage/scrim/white-alpha token decision remains open. Wrap-risk flag remains **browser gate pending**: units now exercise actual handler movement and mocked caret geometry, not merely native pass-through; real browser glyph/scroll geometry, pointer selection, IME, bidi, and visual-line behavior still require manager review. Rerun unchanged `kit.spec.ts` wrap case and `image-lightbox.spec.ts` initial-fit/reset case; no browser assertion was removed or relaxed. Shared `TextBlockView` change is explicitly limited to no-wrap code under B1 authorization.

### Design-gate additions — D1–D6

All six additions are in `d54549e7` (`fix(ui): address media design gate stacking and chrome findings`).

| Item | Result / evidence |
| --- | --- |
| D1 | Media bar and both image/artifact resize controls use `--z-index-pane-overlay` = 4 above selection wash `--z-index-drop-indicator` = 3. Audited actual TSX ancestor chains: `.obe-blockbody` → image figure/frame, artifact figure/frame, or codeblock; none introduces z-index, opacity, transforms, filter, isolation or containment between wash and controls. Contract tests resolve token numbers and check these ancestor rules. Manager must rerun adjacent drag/drop-indicator e2e and selected-media captures. |
| D2 | Code bottom padding is 1rem; reserved top band unchanged. Existing geometry contract updated only to the new pinned padding literal. |
| D3 | Plain media bar uses top/right 4px, asserted by contract. |
| D4 | Removed free-text Language gear field; chip/dropdown owns language selection. File/output name, Hide code, Wrap code and Live remain. Added absence/presence assertions without removing existing assertions. |
| D5 | Zoom bar and close tile use popover background, menu shadow, and border 0. Their text/icons use paired popover foreground and semantic hover fill so the new surfaces work in light mode too. Stage scrim, caption and focus-ring literals remain unchanged under G-c; no new stage token invented. |
| D6 | Shared image menu renderer adds lucide Scaling before Image size, covering both dropdown and context menu. Existing item-list/preset tests remain intact. |

Focused design verification: 55/55 tests across mediaStyles, codeMedia, imageBlock and imageLightbox. The prior verification was intentionally stopped when the design additions arrived; it is not counted as a green run. A fresh full foreground run covers the final implementation. Visual recaptures should include selected image/artifact controls above the wash, code spacing and gear contents, light/dark lightbox tiles, and both Image size menu entries.


Final review verification: `pnpm --filter open-book run verify` exited **0** in this turn on `d54549e7`, covering all B/Q/D implementation commits. **4,543 workspace unit tests passed**: SDK 580 (32 files), UI 2,514 (253 files), app 9 (3 files), server 1,440 (106 passing files; 1 file/8 tests skipped as before). ESLint-rule tests 7/7; MCP script tests all pass; server protocol e2e **256 checks**, MCP protocol e2e **70 checks**. All builds, generated checks, typechecks and lint passed; UI ESLint has 205 warnings/0 errors and CSS has 138 warnings/0 errors (148→138 this review, 162→138 overall). Full log: `/tmp/dsx-review-final-verify.log`. No implementation changes followed this run. The reverted backup race did not recur during this successful run; its permanent replacement remains PR #391's responsibility.

Final disposition: **11/11 review items addressed**, five implementation commits plus this report/ledger commit, no push. Browser/design gate remains pending manager reruns for B1/B2/D1 and visual captures; unit success is not claimed as a browser pass. Input `_brief.md` remains untouched and untracked. `git diff --check` is clean.
