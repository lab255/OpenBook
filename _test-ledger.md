# DSX-4 test ledger

Final result: full `pnpm --filter open-book run verify` exit 0 in-turn; SDK 580, UI 2,510, app 9, server 1,441 passed (8 pre-existing server skips), MCP scripts passed; protocol e2e 256 server + 70 MCP checks passed. Final UI follow-up build/typecheck/lint/test also green. No Playwright run.

Implementation commits: §1 `cd0a5777`, §2 `c592703d`, §3 `63af4c97`, §4 `c59a7039`, §5 `7abd2bed`; cross-section coverage and locked-code hardening `b171d9c3`; final Copy→Run ordering `86b4efd3`.

| Brief criterion | Evidence / disposition |
|---|---|
| Unified bar reveal: deepest hover, focus, open menu, selection, touch | New `mediaStyles.test.ts` checks the complete CSS selector contract and pointer gating. Actual hover/touch rendering requires browser capture. |
| Exact manifest focus/chrome declarations | New `mediaStyles.test.ts` equality-checks all five declarations and shared focus usage. Semantic aliases use existing themed foreground/hover/ring values. |
| Code language, live-only Run, Hide/Wrap in settings | `codeMedia.test.tsx`: live-only Run, settings toggles, persisted wrap snapshot, read-only Copy/Run and mutation guard. Typechecked Command picker uses display names from `highlight.ts`; gear still accepts free text. |
| D4 long-line caret/selection | `codeMedia.test.tsx`: 300-character highlighted line, scrollLeft=600, Home/End offset roundtrips and native-key pass-through, range 20–280, unchanged text DOM and selection after wrap, true/false persistence. **No browser layout is simulated as proof.** |
| D4 real navigation/scroll/toggle geometry | New `kit.spec.ts` case: native Home/End, actual horizontal scroll, Shift+Home selection, collapse to end, invariant block x/y/width and toolbar x/y, restored height after unwrapping. Authored/typechecked; not run (brief forbids Playwright). |
| `block-editor.spec.ts:422` gutter geometry | Preserved unchanged. Unit CSS/formula check: 4px block pad + 1px border + 32px top inset + 21px/2 line = 47.5px line centre; gutter top 35.5px + 24px/2 = 47.5px. Browser glyph-centre assertion remains manager gate. |
| `html-artifact.spec.ts:114–134`, `htmlArtifactBlock.test.tsx:198,209` | Existing artifact unit suite retained (16 tests); iframe, read-only title/chrome and resize assertions unchanged. E2E retained for manager. Alias classes retained. |
| `imageBlock.test.tsx:297,320` readonly figcaption | Existing readonly and present-mode caption assertions retained and passing. |
| Open full size labels: image-lightbox e2e :53/:104, context-suppression :91, imageLightbox unit :67 | Labels unchanged; imageLightbox unit suite passes (16). Browser tests retained. |
| `kit.spec.ts:33–61`, :89/:95 | Existing browser cases unchanged. Existing `inputs2Render`, `chartsInteractive`, `kitConfig`, `kitPanel` unit suites pass; gear remains a Radix trigger, media styling opt-in so other kit geometry stays intact. |
| `export-parity.spec.ts:127` | Retained unchanged. Toolbar work does not modify `toHtml` or `exportBlocks`; known pre radius/colour debt untouched. Browser parity remains manager gate. |
| Intentional caption-source changes | `imageLightbox.test.tsx` distinguishes alt label from visible caption, checks alt-only has no caption; `image-lightbox.spec.ts` fixture/assertion now uses distinct caption. |
| Intentional edit-time alt | `imageBlock.test.tsx` opens ⋯ → Set alt text, waits for focus, then verifies blur removes editor. Fix prevents Radix close autofocus from dismissing the new editor. |
| Intentional menu-only S/M/L | Retargeted image tests exercise Small/Medium/Full width persistence in the submenu; localized-label coverage retained. |
| Context-menu list unchanged | Original seven-item assertion and active-size check retained; context and dropdown share one item renderer. |
| Two resize edges and clamp | New image test exercises both edges around fixed centre, 50% symmetry, 15/100% clamps, listener removal after pointerup. |
| Intentional viewer chrome | `e2e-viewer/viewer-bundle.spec.ts` checks `.obe-media-btn[data-chrome=author]` absent and Copy visible after hover. Authored/typechecked, not run. |
| Lightbox caption/zoom layout | New `mediaStyles.test.ts`: source child order caption→zoom, static/nonshrinking zoom row, nonshrinking caption and shrinking stage, control-height aliases. Actual pixels/short viewport require browser gate. |
| Stylelint debt shrinks | Same config before/after: 162→148 warnings; 0 errors. This repository has warn-only rules, not enumerated baseline entries. Baseline comments updated; no suppressions added. ArtifactOverlay raw z finding removed. `assert-spacing-stylelint.mjs` including `--obe-code-num` untouched. |

Browser manager rerun: `block-editor.spec.ts`, `html-artifact.spec.ts`, `image-lightbox.spec.ts`, `context-suppression.spec.ts`, `kit.spec.ts`, `export-parity.spec.ts`, and `e2e-viewer/viewer-bundle.spec.ts`. Include existing image resize/context-menu and gutter capture scenarios where covered by that suite.

Environment diagnosis: sandboxed mirror integration hit filesystem-watch EMFILE; identical isolated test passes 3/3 with approved access outside the sandbox. Full verify rerun uses that access; no server change was needed for the watcher restriction.

Verification prerequisite `9d1a2c58`: full run subsequently found backupBoot ENOTEMPTY/PGlite-closed teardown race. BackupScheduler.stop now drains active ticks, and server close awaits it. New drain regression fails on original implementation and passes with fix; backupBoot + backups: 31 passed. No original server test weakened or suppressed.

Final width alignment `221cd260`: frame and caption explicitly share 100% default and 30/60/100% preset widths. Existing image suite extended with width equality assertions (28 passed). Follow-up full UI build/typecheck/lint/test passed (253 files, 2,510 tests), validating the final UI source after the workspace run’s earlier UI phase.
