# MEET-1 — Audio asset support in the asset store

You are a Worker agent on the OpenBook team. Work ONLY in this worktree (`/Users/eliot/Workspaces/OpenBook-wt-meet-1`, branch `feat/meet-1-audio-assets`). Do NOT push. Do NOT touch main. Commit incrementally with conventional commits (`feat(server,sdk): … (MEET-1)`).

## Task
Extend the asset store to accept and serve AUDIO. Today the allowlist is images-only: `ASSET_IMAGE_MIMES` at `packages/sdk/src/importAssets.ts:55`; `safeAssetMime` at `packages/server/src/app.ts:332` rewrites everything else to `application/octet-stream`. Upload route `POST /api/assets?pageId=` at `app.ts:1581-1633`; serve route `GET /api/assets/:id` at `app.ts:1660-1690` (ETag/304, `private, immutable`, nosniff, `Content-Disposition: attachment`, `?encoding=base64` variant). Line numbers are recon-time hints — trust the code.

## Acceptance (each maps to a test)
1. New audio allowlist in sdk (e.g. `ASSET_AUDIO_MIMES`): `audio/webm`, `audio/ogg`, `audio/mpeg`, `audio/mp4`, `audio/wav`. Audio uploads are stored AND served back with their real MIME, not octet-stream.
2. Route shapes unchanged; ETag / attachment / nosniff behavior preserved for all types. Unit tests cover an audio round-trip including the base64-JSON upload variant (desktop IPC path — see `packages/sdk/src/client.ts:1571`).
3. The 10 MiB per-asset cap (`app.ts:1485`) stays; add a code comment noting meeting-recording chunks are sized under it.
4. GC safety: `gcUnreferencedAssets` (`packages/server/src/store.ts:5610`; NOTE: store.ts contains a NUL byte — use `grep -a`) keeps an asset whose id appears in page data. Add a test proving an audio assetId stored in block props survives GC.
5. Security: audio must never be served inline-executable; keep `Content-Disposition: attachment` and nosniff. No change to access gating (default-deny, `access.ts`).

## Definition of done
- `pnpm verify` green, run FOREGROUND in this worktree, full output in your report. (Worktree is pre-provisioned; if you see "N test FILES failed, 0 tests failed" it's build artifacts — run `pnpm --filter @book.dev/ui run build:viewer` and `pnpm --filter @book.dev/server build && pnpm --filter @book.dev/mcp build`.)
- All work committed. Do not push.
- Write `_report.md` in the worktree root AND reply with it: outcome first (PASS/FAIL), head sha, criterion→test/commit map, deltas/deviations only, open questions. Terse.

## Rules
- Never poll/babysit anything external; deliver, report, end.
- If genuinely stuck after a real attempt, commit what you have and report where you're wedged — do not thrash.
- Don't delete or weaken ANY existing test. Reviews will check the full commit range.
