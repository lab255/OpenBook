# DSX-3 — container family alignment

Implemented all six sections in six incremental conventional commits plus one scoped section-5 review fix on `feat/dsx-3-containers`. **`pnpm verify` passed (exit 0) in this turn on the final committed code, completed 2026-10-10 at 12:58 SGT.** No push.

| Criterion | Commit | Evidence |
| --- | --- | --- |
| 1. Shared 24px inset; unclipped container frame; rounded header background | `b3876cc4` | `gutterStyles.test.ts`: token equals the 24px gutter button; frame has no overflow clip; header follows frame radius minus border. Inspection found no scroll-shadow dependency on the clip. |
| 2. Body/header inset equality | `9d8118e0` | All three bodies use the inset token. Header tests cover hanging group icon, accordion toggle width, zero extra icon gap, and tab-strip compensation for the header inset. |
| 3. Header heights/type scale | `02813cf5` | Three 32px minimum headers, fixed 28px tabs, caption-sized badges, shared small labels and 600 weights; CSS regression assertions. |
| 4. Handle/selection/focus/button alignment | `eebf8ea5` | Shared group/tabs/accordion header offsets and selection radius; all four focus selectors; 24px controls. CSS test helper now matches complete selectors rather than accidentally reading a descendant rule. |
| 5. Surfaces, badge, chevron, naming | `1b2b99e4` + `5eba7b86` | Border-only group, dashed locked frames, unified divider alpha and one 0.5 disabled-control rule. `containerViews.test.tsx` covers item creation in en/de/ja/zh, retained authored labels, and the same SVG surviving collapse/reopen. Surface/badge CSS equality tests. Slash-menu defaults also use Item N. Final review scopes dashed borders to directly owned locked children/tabs; a nested-container DOM regression test passes with the 29-test gutter suite. |
| 6. HTML export parity | `92594ba6` | `containerParity.test.ts`: 13 cases cover normalized weighted spans and 28px gap, frame/token equality, light/dark borders and muted colours, caption eyebrows, native details/open-state precedence, nested/empty frames, sibling boundaries, reactive input preservation, Markdown and slide-deck continuity. Existing export regression suites retained. |

## Validation

- Targeted unit run: **100 files / 1,099 tests passed**. Explicit UI filter; block-editor tests, kit tests, export tests, block-export tests and template tests.
- Section-5 container/i18n run: **3 files / 44 tests passed**.
- UI typecheck, changed-file ESLint, CSS error gate and `git diff --check` passed before the full gate. Commit hooks also ran ESLint/typecheck and commitlint.
- **Full foreground `pnpm verify`: PASS, exit 0.** Includes ESLint-rule tests, library builds, generated-file equality, all workspace typechecks/lint/unit scripts, server e2e and MCP e2e. Final counts: SDK **580**, UI **2,533**, desktop **9**, server **1,440** passing tests; server **8 existing conditional skips** (Beancount/native runtime/native Whisper/real Postgres), none introduced here. Server e2e **256/256** checks; MCP e2e **70/70** checks; MCP catalogue coverage **45 types + 9 plugin blocks**. Server suite took 892.63 seconds. [Full log](/tmp/dsx3-verify.log); [targeted log](/tmp/dsx3-targeted.log).
- Environment diagnosis: the first sandboxed full run hit `EMFILE` from macOS filesystem watchers in `mirror.integration.test.ts`; an isolated sandboxed rerun reproduced it. The unchanged suite passed **3/3** outside the sandbox. Stopped the failed sandboxed run and restarted outside the sandbox without watcher workarounds or skipped checks. Restarted that full run once more after committing the nested-lock CSS refinement, so the final gate covers the final source. Diagnostic logs: `/tmp/dsx3-verify-sandbox.log`, `/tmp/dsx3-mirror-recheck.log`, `/tmp/dsx3-mirror-unrestricted.log`.
- Playwright was not run, per brief. The named `kit-blocks.spec.ts`, `block-editor.spec.ts`, and `templates.spec.ts` are browser specs, not Vitest suites; the unit coverage above exercises their relevant model/render/export paths. Manager-side browser regression should include those three, plus `block-gutter-captures.spec.ts`, `column-resize-captures.spec.ts`, `export-html.spec.ts`, `export.spec.ts`, `pdf-export.spec.ts`, and export-viewer captures.

## Design choices and compatibility

- Badge uses `--data-green-chip-bg` / `--data-green-chip-fg`, installed at `:root` by `ThemeProvider` and the export viewer through `applyDataColors`. Nested `--obe-bg-green` / `--obe-fg-green` fallbacks cover providerless editors.
- Existing `exportKit2.test.ts` requires a flat accordion projection with a header and live child inputs. Preserved that test and contract: headers carry container range metadata; HTML renders native details/eyebrows around the same flat children. Linear Markdown/PDF consumers retain their heading convention. Container labels do not become HTML h3s or table-of-contents entries. A divider inside a container stays inside its slide instead of breaking its range.
- Updated only the existing equal-column HTML literal assertion for the new `flex:6 1 0` attributes. Existing gutter column/divider assertions already use correct tokens/geometry; none needed changing, and none were removed or weakened.
- No lint-guard baseline edits. Three documented, declaration-scoped stylelint exceptions permit the brief's calculated inner radius and negative token-based icon/tab offsets; guard rules and their negative controls remain intact.
- The group still uses “Section”; existing authored accordion labels are preserved. New defaults and add/label controls use localized “Item”. Tabs accessibility structure and gutter/menu chrome were left in their assigned scope.

## Capture matrix and proposed gates

**Design gate:** capture all four container families in light/dark, editable/read-only, selected/focused and locked/gated states. Group, tabs and accordion change in the editor; columns change in clipboard/static HTML (the editor already used 28px gaps and normalized spans). Include unequal columns, nested handles near borders, active/inactive tabs with completion badges, expanded/collapsed accordion items, and group frames in exports. Verify header text at the 24px inset and consistent tab height in a real browser; unit DOM/CSS tests cannot establish pixel geometry.

**Code gate:** review the section commits and scoped lock-border refinement and foreground verification evidence, especially flat export-range metadata, nested closure ordering, generated-file cleanliness and sibling DSX-2 integration. No text-block renderer, text-block CSS or shared icon-size token was changed.

## Follow-up card proposals

1. **Tabs accessibility:** replace input-inside-tab-button structure; implement arrow-key navigation, roving tabindex, stable panel IDs and aria-controls; add keyboard/browser tests.
2. **DSX-7 columns handle collision (audit P2 #10):** test nested handles against column divider targets at narrow widths and unequal spans; resolve in the chrome owner branch.
3. **Gate/add placement unification (audit P2 #13):** agree and implement consistent placement across tabs and accordion after design review.

Git commits completed successfully despite a non-fatal sandbox warning about `packed-refs.lock` creation; all implementation hashes were checked. No push, binaries or generated build artifacts are included. `_brief.md` remains the pre-existing untracked task input.
