DSX-7 implemented and committed as `0ec29b68`; all 52 required browser tests pass. **Acceptance blocked: full `pnpm verify` fails in unrelated server audio fixtures.** No push.

Commit map: `0ec29b68` — `fix(ui): align block chrome with dsx-7 audit geometry` — gutter/handle tokens and lead-line formula; selection overlay; padding, heading spacing and block-root margin cleanup; innermost hover and keyboard focus; column gap/dividers; tint/drop bleed; capped side-drop zones; symmetric document margins; todo/list alignment; table reserves; unit and browser regression coverage.

Measured in Chromium at the default 16px editor font:

| Geometry | Measured | Audit target |
| --- | --- | --- |
| Handle | 18×24 = 432px² | 18×24 = 432px² |
| Paragraph pitch | 32px | 32px |
| Gutter tops: paragraph / h1 / h2 / h3 / callout | 4 / 43.5 / 31.6 / 21 / 16px | Same |
| Full-width margins | 90 / 90px | 90 / 90px |
| List / todo text start | 24 / 24px | 24 / 24px |
| Selection horizontal bleed | 4px | 4px |
| Heading overlay top: h1 / h2 / h3 | 32 / 24 / 16px | Heading space tokens |
| Selection height change | 0px across all eight fixture rows | 0px |
| Selection row shadow | none | none |
| Chrome focus outline offset | 2px | 2px |

Browser e2e: **52/52 passed, zero skips/retries** — `block-editor.spec.ts` 36; `table-grips.spec.ts` 6; `block-gutter-captures.spec.ts` 5; `context-suppression.spec.ts` 4; `viewer-readonly.spec.ts` 1. Real drags, marquee, selection counts, table hit targets and read-only behavior pass. Table lead offset preserves non-overlapping active block/row drag targets. Existing tests retained.

Validation: gutter unit tests 15/15; UI 250 files / 2411 tests pass; builds, generated-file checks, typechecking and lint pass. The remaining `pnpm run test:e2e` phase passes separately: server 256 checks, MCP 70 checks.

**Foreground `pnpm verify`: NOT GREEN.** Final run: server 99 files pass / 2 fail; 1395 tests pass / 4 fail / 7 existing skips; 2 unhandled errors. Failures are unchanged server audio process-startup fixtures: `transcription.test.ts:172` and `ai/whisper.test.ts:49,67` time out awaiting fake-process markers. A single-test rerun passes unchanged; rerunning both audio files reproduces transcription failure (23 pass, 1 fail, 1 existing skip), while Whisper passes. No server tests changed or weakened. Earlier sandbox watcher failure passed 3/3 outside the sandbox; browser execution also required sandbox escalation.

Evidence: [browser results](/tmp/dsx7-e2e.json), [final verify log](/tmp/dsx7-verify.log), [server/MCP e2e log](/tmp/dsx7-server-mcp-e2e.log), [isolated audio suites](/tmp/dsx7-audio-isolated.log).

Open questions: no geometry questions. The green verification gate remains blocked by server audio fixtures outside DSX-7 scope. Brief and report remain untracked; no push.
