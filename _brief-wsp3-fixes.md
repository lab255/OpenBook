# WSP-3 fix round — apply Quinn's PRE-ENDORSED fixes exactly (F1-F9)

Branch `feat/wsp-3-one-click-transcription`, worktree /Users/eliot/Workspaces/OpenBook-wt-wsp3 (HEAD ec2a00a1). Apply all nine exactly as specified; line numbers at ec2a00a1.

1. **F1** LocalTranscription.tsx:54 — add `actionable` (after :20): `!audio.modelPresent || Boolean(audio.modelUpdateAvailable) || tools.some(([, tool]) => !tool.override && (tool.status === 'missing' || tool.status === 'failed'))`; button renders `{!current && (actionable || active) && …}`.
2. **F2** stage-label gap — prefer the SERVER variant: in runtime.ts set `this.stages[tool] = {status: 'provisioning'}` BEFORE `await this.binary(tool)` and delete it on the `continue` path (keeps UI logic simple); if that fights the skip/override tests, fall back to the reviewed client-side `runtimePhase` guard on :36. State which you chose.
3. **F3** runtime.ts:85 — unwrap cause: `const root = error instanceof Error && error.cause instanceof Error ? error.cause : error; const detail = root instanceof Error ? root.message : String(root);`
4. **F4** i18n — new key `ai.transcription.stageLine: '{stage}: {state}'` (ja/zh use '：'), used for model + tool lines; add `modelReady` short value per locale; remove the hardcoded ": ".
5. **F5** meeting unconfigured copy (en.ts:1146 + de/ja/zh) — en: 'Go to Settings → AI, choose a transcription provider (or "Enable local transcription"), then retry.' Translate consistently.
6. **F6** runtime.test.ts — add `abort clears the stage without marking failed` (AbortController, abort while fetch gated, assert rejection + status==='missing' + no detail).
7. **F7** ai-transcription.spec.ts — add one UNMOCKED e2e `real status pipeline renders tool lines` exactly as reviewed (no page.route for status; assert /^whisper-cli: / and /^ffmpeg: / lines + button-or-ready; click NOTHING).
8. **F8** extract `toolLabel(tool, name, t)` helper (same file).
9. **F9** whisper.ts:123 `runtime.tools[tool].status !== 'provisioned'` instead of per-poll binary(); :130-131 ternary → `detail: !(modelPresent && runtimeAvailable) ? 'Enable local transcription in Settings → AI.' : undefined`.

## Validate + commit
Foreground: ui AiSettings/LocalTranscription vitest files + server runtime/whisper/serviceDownload/transcription suites + `pnpm --filter @book.dev/web exec playwright test e2e/ai-transcription.spec.ts` + ui/server typecheck+lint. One or two conventional commits, NO push, no brief/report files. Report `_report-wsp3-fixes.md`: pass/fail + HEAD + per-fix line (incl. F2 variant chosen) + results. Terse.
