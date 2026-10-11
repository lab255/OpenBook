Outcome: DONE. Foreground pnpm verify GREEN (exit 0): 4,660 unit tests passed; 256 server + 70 MCP e2e checks passed; ESLint rule checks 7/7 and MCP contract scripts passed. Kit browser tests: 21/21. Committed on feat/dsx-6b-input-controls; no push, PR, or board write.

Criterion → commit map:
1. Heights and token fonts → f6e4a65f; browser geometry coverage → f7a5a72f + d2a58b27.
2. Chrome hover, neutral surface borders, preserved primary selection → f6e4a65f; compact hover/selection checks → d2a58b27.
3. Disabled token and shared rule, existing page-read-only interactive exemption preserved → f6e4a65f; disabled browser checks → d2a58b27.
4. Wide dropdown wrapper and searchable-select width → f6e4a65f; browser width assertions → f7a5a72f.
5. Palette cover preserved; colourless muted fallback → f6e4a65f; light/dark browser assertions → f7a5a72f.
6. Remaining input/config literals → f6e4a65f. Formatting cleanup → 7abcdfaa.
7. Foreground pnpm verify GREEN on the final source outside sandbox; results recorded by this report commit. SDK 580/32 files, UI 2627/263, app 9/3, server 1444/106; server intentionally skips 9 tests/2 files. Builds, generated mirrors, typechecks and lint passed. Browser: 21/21 passed (kit, kit-blocks, kit-chrome; light/dark).
8. Conventional commits above plus this report commit; clean worktree after committing the report. No push.

Tests updated:
- packages/ui/src/blockeditor/kit/__tests__/inputsRender.test.tsx: added wide/compact wrapper assertions (w-full only when wide); no existing assertion removed. Targeted inputsRender + unchanged inputs2Render: 15 passed / 2 files.
- packages/web/e2e/kit-chrome.spec.ts: added exact 28/32/36px control heights, 24px format buttons, 20px switch, width equality with the kit column, and palette/muted cover checks in both themes. Seeded a blue and a colourless option. Added compact 28px controls, selected hover borders and disabled opacity 0.5/cursor checks. Existing assertions retained; no pinned value required changing.

Pre-done by 6a: none of the optional overlap sites in §12. Symbol hint, KitFrame hints/ScopeHints, chart config hints/source-toggle and OptionsEditor still needed the listed changes. Existing KitFrame chrome, focus treatment, placeholder token, interactive read-only exemption, native checklist checkboxes and free-entry tag pills retained.

Deferred discoveries:
- DSX-6d: .obe-form-preview .obe-kit-action:disabled still has its own opacity: 0.62; form styles/components were not changed.
- DSX-6c: standalone export CSS in toHtml.ts remains outside this slice; no chart internals, export CSS or data-palette values changed. Only the explicitly listed chart configuration text/radius sites changed.

Git commits succeeded. Git emitted a nonfatal packed-refs.lock housekeeping permission warning; no index.lock failure or destructive retry.

Pre-existing untracked audit/brief/report/capture files were preserved at /Users/eliot/.bb/thread-storage/dsx6b-input-controls/preexisting/ to satisfy the clean-worktree criterion without committing unrelated artifacts. This includes the original _brief-dsx6b-worker.md contract.

Browser measurements: text/location/action rows 40px; radio/checklist rows 147.95px; wide dropdown/search rows 63.95px; compact dropdown/radio rows 36px. Exact control sizes pass independently of row chrome. Native checklist interaction, location edits, dropdown scope publication and offline kit computation passed existing e2e checks.

Environment: initial foreground verify passed builds, generated mirrors, typechecks, lint, SDK 580/UI 2627/app 9 tests and MCP contracts. Sandbox server suite: 1443 passed, 1 mirror test failed, 9 skipped; 14 fs.watch EMFILE errors. Chromium also required execution outside the sandbox (macOS MachPort registration denied inside it). No product/test changes were made to mask either restriction. Browser rerun outside sandbox passed 21/21. The complete foreground pnpm verify rerun outside sandbox then passed with exit 0; server suite duration 821.31s. CSS lint warnings reduced from 111 to 87 (zero errors).

Validation logs: /Users/eliot/.bb/thread-storage/dsx6b-input-controls/validation/ (targeted-unit.log, browser.log, verify-sandbox.log; verify-green.log).
