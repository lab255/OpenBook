# WSP-3 design-fix round — Devon's gate findings (M1, M2, L1, L2 + two cheap nits)

Branch `feat/wsp-3-one-click-transcription`, worktree /Users/eliot/Workspaces/OpenBook-wt-wsp3 (HEAD 15db010f). Small, exact changes to LocalTranscription.tsx + i18n ×4 (en/de/ja/zh). Devon's shapes:

1. **M1 — update state must say why**: when `modelUpdateAvailable` (or a tool is stale), the stale stage line reads "Update available" (new i18n value used via the existing stageLine key), e.g. "Whisper model: Update available" — not "Downloaded". Keep the button primary (reason-on-line is the fix; don't also demote the button).
2. **M2 — partial-unsupported button honesty**: when any tool is unsupported-without-override, the action button label becomes "Download available components" (new key) instead of "Enable local transcription"; everything else unchanged. (It still does the same thing; the label no longer promises a finished setup.)
3. **L1**: "Model not downloaded." → "Not downloaded" (no trailing period; the stageLine key supplies "Whisper model: " already).
4. **L2**: verb pairs — tools: "Not installed"/"Installed"; model: "Not downloaded"/"Downloaded". Sweep all four locales consistently.
5. **Nit (apply)**: stage lines + "Ready to transcribe." on the same caption type size (match the section's description text size).
6. **Nit (apply)**: "ffmpeg" display label → "FFmpeg" (binary name stays lowercase only in env-var hints/code).

NOT in scope (recorded for later): plain-English tool labels, docs-link in partial state, "Waiting" pre-stage status.

## Validate + commit
Foreground: LocalTranscription/AiSettings vitest + `pnpm --filter @book.dev/web exec playwright test e2e/ai-transcription.spec.ts` + ui typecheck/lint; update any test strings that pinned the old copy (update assertions, never delete). One conventional commit, NO push, no brief/report files. Report `_report-wsp3-design-fixes.md`: per-fix line + results. Terse.
