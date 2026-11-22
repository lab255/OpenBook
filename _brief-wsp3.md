# WSP-3 — One-click Settings → AI: "Enable local transcription" with staged progress + update path

Worker on branch `feat/wsp-3-one-click-transcription` (STACKED on feat/wsp-2-runtime-provisioning @ 48ca25ce, itself on WSP-1; merge order 1→2→3; if those move, merge — never rebase). Worktree /Users/eliot/Workspaces/OpenBook-wt-wsp3. Scope: packages/ui (+ sdk/server ONLY if a status field is genuinely missing — justify).

## Context (read code first; existing code wins over this brief)
- Server now auto-provisions runtime binaries with the model: `AiService.startDownload` provisions (non-blocking, override-skip) + `downloadPinned` for the model; status: `AiStatus.transcription` with receipt-aware `modelPresent` and typed `transcription.runtime` (per-tool status + desired/installed versions) — packages/sdk/src/ai.ts, packages/server/src/ai/{service,whisper,runtime}.ts.
- UI today: AiSettings.tsx:285-370 "Transcription" section — provider select, docs-link manual-install hint, status line, "Download Whisper base" button disabled when modelPresent, error line. Strings en.ts:849-867; meeting-block unconfigured copy en.ts:1138.
- A pin bump now means "update available" (model receipt mismatch / runtime version behind desired).

## Scope
1. Replace the download button + manual-install hint with ONE primary action: **"Enable local transcription"** when not ready; **"Update local transcription"** when pins are ahead; hidden/success state when ready+current. One click drives the whole model+runtime flow (existing aiDownloadModel client call; server does the rest).
2. **Staged progress**: render model download progress (existing AiStatus.download) + runtime provisioning state from `transcription.runtime` (per-tool: provisioning/installed/unsupported/failed). Keep it one compact line per stage — no new panel sprawl (match the section's existing density).
3. **Truthful states**: typed-unsupported tools render as informative non-error状态 ("built-in runtime unavailable on this platform" style copy pointing at the env-var escape hatch, NOT an install-whisper-cli instruction); provisioning errors name the failing stage/tool; env-override active → show which override is in use.
4. **Copy**: remove install-instruction strings (en.ts:855,862 et al); update meetingBlock.unconfigured (en.ts:1138) to point at the one-click path; i18n ×4 (en/de/ja/zh — real translations consistent with each file's existing register).
5. **e2e** (packages/web): fresh instance → Transcription section shows single enable action; clicking surfaces staged progress (mock/fixture-backed as the harness allows — look at existing ai-settings e2e patterns); unsupported-platform state renders the informative copy; update state renders when receipts are stale.

## Acceptance
- Zero manual-install copy anywhere in the app (grep i18n files for whisper-cli/FFmpeg install instructions).
- All states reachable + tested: enable / in-progress (both stages) / partial-unsupported / error-with-stage / update-available / ready.
- `pnpm verify` FOREGROUND green (expect the whisper.test.ts 10s-poll fix from WSP-1 present on this branch). No existing test deleted/weakened. Conventional commits, NO push, do NOT commit brief/report files.

## Report
`_report-wsp3.md`: outcome first (pass/fail + HEAD), criterion→commit/test map, state-coverage list, strings added/removed count per locale, open questions + defaults. Terse. (Captures are the manager's job afterwards — list which states are most capture-worthy.)
