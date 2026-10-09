# WSP-2 — Runtime provisioning: binaries install into <dataDir>/bin with the model; re-provision on pin bump

Worker on branch `feat/wsp-2-runtime-provisioning` (STACKED on feat/wsp-1-verified-downloads @ 81bbcf83 — merge order is WSP-1 first; if main moves under you, merge main in, don't rebase). Worktree /Users/eliot/Workspaces/OpenBook-wt-wsp2. Scope: packages/server (+ minimal sdk/ui ONLY if the status contract genuinely needs it — justify in report).

## Context (WSP-1 landed the foundation — read these first, existing code wins over this brief)
- `src/ai/download.ts` — checksum-verified streamer (.part → fsync → atomic rename).
- `src/ai/pinnedDownload.ts` — receipt-based version-aware skip/re-download.
- `src/ai/runtimeManifest.ts` — per-target pins for whisper-cli/ffmpeg incl. typed-unsupported entries and `extractDir` (Windows whisper: install the ENTIRE Release/ dir — companion DLLs required).
- `src/ai/whisper.ts` — LocalWhisper; PATH walk at :21-31 misses Windows .exe (no PATHEXT); `src/ai/service.ts` — AiService; `src/server.ts:438-441` dataDir wiring.

## Scope
1. **Provisioning**: on transcription enable / model download / pin bump — resolve the platform triple (reuse the logic pattern of packages/server/scripts/build-sidecar.mjs:27-57), download the pinned archives via the verified layer, extract (honouring extractDir) into `<dataDir>/bin/<tool>/`, chmod +x, macOS `xattr -d com.apple.quarantine` (ignore failure if attr absent), write version receipts. Typed-unsupported targets: provision what's supported, report the rest in status (never an exception). Extraction must be dependency-light (zip + tar.xz; check what's already in the tree before adding a dep — justify any new dep in the report).
2. **Resolution order** in LocalWhisper: env vars → managed `<dataDir>/bin` → PATH walk; fix the PATHEXT miss so `whisper-cli.exe`/`ffmpeg.exe` resolve on Windows.
3. **Review-sourced (Quinn @ WSP-1, PRE-AGREED)**:
   - F3: export `isPinnedCurrent(pin, dest)` from pinnedDownload.ts (same identity+size check as the skip); gate model readiness on it; KEEP the `modelPresent` key name (AiStatus contract unchanged); legacy/failed-upgrade files surface as needs-download.
   - F6: wire AbortSignal through downloads so `dispose()` cancels in-flight work; orphan .part overwritten safely on next attempt.
4. **status()**: reports managed runtime versions + per-tool provisioned/unsupported/missing, so the UI (WSP-3, not yours) can render one truthful enable/update state.

## Acceptance
- Fresh dataDir → enable → `ready:true` on a platform with full support (native smoke gated like OPENBOOK_TEST_WHISPER; transcription.test.ts:231-233 pattern). On THIS machine (darwin-arm64) whisper-cli is typed-unsupported — the smoke must assert the typed-partial status path instead, plus unit-test the full path with fixture archives.
- Corrupted/truncated archive → clear error, no partial install, old install intact.
- Env-var override still wins; pin bump re-provisions; receipts crash-safe (same ordering discipline as pinnedDownload).
- isPinnedCurrent gating + abort-cancellation unit-tested.
- No existing test deleted/weakened (commit range is reviewed for this). `pnpm verify` FOREGROUND green before reporting.

## Rules
Conventional commits, incremental, NO push. Blocked >30min → question + recommended default in report, keep going elsewhere. Report `_report-wsp2.md`: outcome first (pass/fail + HEAD sha), criterion→commit/test map, deps added (or none), open questions. Terse.
