# DSX-5a report

D1–D17 implemented, menus committed first; **full `pnpm verify` green in-turn (exit 0)**; local commits only, no push. Existing assertions and test pin values remain intact: none required a value change. Design and code gates proposed. Browser geometry and Chromatic approval remain for the manager's capture pass (Playwright was not run).

## Delta → commit

| Deltas | Commit | Result |
|---|---|---|
| D2, D4–D8 | `a80be541` | Five icon-only toolbar controls, shared tooltips and exact accessible names/count suffixes; shared small fields/focus rings; additive menu recipe export; popover action/separator recipes; readable menu labels. |
| D1, D3 | `66b1c1c3` | Right tools `sm:ml-auto`; inline frame removed; full-page frame retained. |
| D9–D16 | `e007e7ca` | Table row hover tint removed; selected-cell wash over opaque sticky title; normal-weight headers; readable icons/counts; compact list; quiet footer; named z tiers; centered title wrapper. |
| D17 | `e609f8be` | Manifest §3: select/multi-select chips use radius-sm; status chips remain pill; dated owner decision. Chip styling untouched. |
| D16 / density | `2de16407` | Explicit 33px data-row height floor preserves density when title-cell padding is removed. Content may still expand rows as before. |
| D14 scope correction | `0024e27c` | Preserve grouped body-summary dividers; separator removal applies only to tfoot. |

`toolButtonClass` had additional consumers beyond the listed references: all were migrated to remove the helper. Existing semantic icons (arrows, link, delete, etc.) and labels remain; add-condition/group/sort/rule controls retain leading Plus. D8's actual menu source had five `text-[11px]` occurrences, including the shared eyebrow recipe; all migrated to text-xs. Prose hints remain sentence case; eyebrows use the specified weight/tracking/contrast. Card layout changes are restricted to the shared field recipe and its two Select consumers. The core `.obe-table*` block is untouched. Dropdown-menu.tsx has only the requested additive export.

## Density ledger

Source/token verification, not a claim of measured browser geometry. Unit tests use happy-dom and provide no real layout/geometry harness.

| Surface | Verification | Browser acceptance |
|---|---|---|
| Toolbar | Each icon control is 16px + 2×4px padding = 24px; count text has 16px line height, with horizontal padding only. Labels removed; search remains w-36; narrow overflow and responsive wrapping retained. | Confirm −36px for the audit's wrapped fixture; <44px narrow toolbar and horizontal scrolling. Width-dependent savings cannot be proven from class arithmetic alone. |
| Inline database | Remove 2×12px padding + 2×1px borders = **−26px**; full-page spacing untouched. | Capture inline and full-page side by side. |
| List | py-2 → py-1 removes **8px per row**; New row py-2 → py-1.5 removes **4px**. Content/chip dimensions unchanged. | Confirm grouped/ungrouped rows. |
| Popover fields | Ordinary text-sm fields: 20px line + 8px padding + 2px border = 30px → shared **28px**, **−2px**. | **Ledger qualification:** existing single-line text-xs overrides (including board summary fields) were 26px and now become 28px, **+2px overlay-only**, as required by D4. The blanket −2px claim does not hold for those fields. |
| Table header | Inline menu control / text line = 20px + 12px vertical padding + 1px border = **33px**; normal font weight does not change line height. | Verify 33px with representative columns. |
| Table data | Explicit **33px** row floor; title td py-0, inner min-h-7 and vertical centering; neighboring cells unchanged. | Verify 33px ordinary rows and title text-box top within **±1px** of neighboring text. Include name-only, plain-text, select/status, and nested rows. |
| Popover items | Borderless old action: 16px line + 8px padding = 24px → 20px + 12px = 32px: **+8px overlay-only**. Former dashed-border items were 26px → 32px: +6px. | Check overlay scrolling and keyboard focus. |

No new in-document vertical padding is introduced. Exact wrapped-toolbar reduction and pixel alignment remain design-gate measurements; field-size qualification above needs explicit review against the brief's ledger wording.

## Test-pin ledger

| Pin | Status / evidence |
|---|---|
| font-weight-layout.spec.ts:163–192 | **Unchanged; needs e2e.** Active tab and All/Any bg-accent pills and 0px-shift assertions preserved. |
| ViewTabContextMenu.test.tsx:146–151 | **Unchanged; unit green.** Search w-36 and no focus:w-* preserved. |
| layout-reservation.spec.ts:90–102 | **Unchanged; needs e2e.** Exact Filter accessible name, fixed search width, no-reflow assertion retained. |
| narrow-width.spec.ts:94–104 | **Unchanged; needs e2e.** <44px toolbar and horizontal-scroll assertions retained. |
| database-parity.spec.ts:273–275,810,821 | **Unchanged; needs e2e.** Exact Condition, Group, Fields names preserved. |
| SummaryPicker.test.tsx:32 | **Unchanged; unit green.** pl-8 and radio assertions preserved. |
| databaseChips.test.tsx:109 | **Unchanged; unit green.** Existing chip editor/context-menu behavior retained. |
| database-views.spec.ts:20–34 | **Needs e2e / Chromatic baseline approval.** Expected visual changes; no image/binary baseline generated here. |

No test assertions were removed, relaxed, or rewritten. No pin edits were necessary.

## Verification

- **PASS — `pnpm --filter open-book verify`, exit 0**, run in the foreground in this turn with an explicit root-package filter, outside the sandbox after the watcher diagnosis below. ESLint-rule tests, library builds, generated-file checks, all workspace typechecks/lint/unit tests, and server/MCP non-browser e2e completed. SDK: **32 files / 580 tests**; UI: **257 files / 2,580 tests**; app: **3 files / 9 tests**; server: **106 files / 1,442 tests passed**, 1 file / 8 tests skipped by the suite. MCP unit/contract scripts passed. Server e2e: **256 checks**; MCP e2e: **70 checks**. Full local log: [_verify-dsx5a.log](_verify-dsx5a.log); isolated watcher evidence: [_mirror-dsx5a.log](_mirror-dsx5a.log). Logs are ignored text artifacts, not committed.
- Initial sandboxed run passed build/check-gen/typecheck/lint, SDK (580), UI (2,580), app (9), and MCP checks, but server mirror integration failed with `EMFILE: too many open files, watch`; disk reimport never arrived. An isolated sandbox rerun reproduced it. The identical test passed **3/3 outside the sandbox** in 4.64s. Stopped the already-failed sandbox run (exit 143) and restarted the complete pipeline outside the sandbox. No assertion or server implementation changed.
- Targeted database unit suite: **16 files / 108 tests passed**, both after menus and table/list edits. Final UI build also passed after the row-height correction.
- Source checks confirm authorized production-file scope, removal of toolButtonClass/menu 11px labels, five tooltip controls, numeric count badges, and exactly one additive CSS rule; `git diff --check` passes.
- Existing build/lint warnings are retained; no generated changes or binaries committed. Git hooks emitted a packed-refs.lock sandbox warning after commits, but all commits were created successfully and verified in the branch log.

## Capture / review gates

- **Design:** light/dark table selection across opaque sticky title cells, horizontal scrolling, hover without row tint, stronger icon chrome, normal-weight 33px headers, quiet calculation footer, title text alignment ±1px; inline/full-page framing; grouped and ungrouped compact lists.
- **Design:** toolbar at wide/wrapped/narrow widths, zero and multiple filter/sort counts, shared tooltips and keyboard focus; menu field rings, eyebrow contrast, separators/add actions, long overlay scrolling. Check the text-xs field exception noted above. Approve updated database-views Chromatic baseline.
- **Code:** review all delta commits, scope boundary, named z tiers, additive export, exact accessible labels/counts, unchanged behavior pins, and full verification result. Manifest change is documentation only; chip-style migration is a later slice.


## Pre-endorsed fix round — 2026-10-10

**All 10 fixes implemented; full `pnpm --filter open-book verify` green in-turn, exit 0. Local commits only; no push.** Implementation: `c56c3a5d` (`fix(ui): apply database shell review corrections`).

| Fix # | Commit | Result |
|---|---|---|
| 1 | `c56c3a5d` | Add metric tile restores `border border-dashed border-border`. |
| 2 | `c56c3a5d` | Advanced-filter chip restores `border border-dashed border-border`. |
| 3 | `c56c3a5d` | Group/Fields tooltips use existing locale keys; exact hardcoded aria-labels preserved. Filter/Sort/View options have no existing locale keys and remain unchanged. |
| 4 | `c56c3a5d` | Filter and Sort popovers align end. |
| 5 | `c56c3a5d` | Sort trigger uses 16px ArrowUpDown; Clear filters & sorts retains ListFilter. |
| 6 | `c56c3a5d` | Condition/Group use w-auto and left alignment; Add sort/rule remain full-width and left-aligned; leading Plus preserved. |
| 7 | `c56c3a5d` | Three sticky table cells (th, body td, tfoot td) use bg-background. |
| 8 | `c56c3a5d` | Toolbar row count uses full text-muted-foreground. |
| 9 | `c56c3a5d` | Five gallery/group/lane counts use full text-muted-foreground; both BoardColumnFooter eyebrows use the sectionLabel recipe. |
| 10 | `c56c3a5d` | Property Description loses text-xs override; mono fields untouched. |

Verification: foreground pipeline awaited to completion in this turn, using the explicit root-package allowlist. Ran outside the sandbox because the earlier report established reproducible sandbox watcher failures. ESLint-rule tests **7/7**; library builds, generated-file checks, workspace typechecks and lint all passed. Vitest: SDK **32 files / 580 tests**, UI **257 / 2,580**, app **3 / 9**, server **106 / 1,442**; aggregate **398 passed files / 4,611 passed tests**, plus **1 file / 8 tests skipped** by the existing suite. MCP unit/contract checks all passed (reported batches: 3, 17, 44, 17, 80, 54, 40, 10; catalogue coverage 45 types + 9 plugin blocks). Server e2e **256 checks**; MCP e2e **70 checks**. Log: `/tmp/dsx5a-fixes-verify.log`. Server unit duration: 824.49s. `git diff --check` passed; commit hooks passed lint/typecheck/commitlint. Git emitted the previously documented packed-refs.lock sandbox warning, but the commit succeeded and was confirmed in the log.

Test pins: **unchanged; no value updates needed, no assertions removed or weakened**. No browser/Chromatic run in this round; the existing browser gates remain for the manager's capture pass. Capture changes: restored dashed outlines, translated Group/Fields tooltips, right-aligned popovers, sort glyph, left-aligned add actions, light/dark sticky seam and selection wash, stronger counts/eyebrows, Description field typography. These fixes supersede the earlier bg-card and Description text-xs notes above. Only the three requested production files changed; no generated files or binaries committed.
