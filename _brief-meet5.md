# MEET-5 — Recorder UI: meeting block view, progressive transcript, manual notes

You are Ellis, an OpenBook Worker agent. Work in THIS worktree (`/Users/eliot/Workspaces/OpenBook-wt-meet-4`). Do NOT push. Conventional commits (`feat(ui): … (MEET-5)`), committed incrementally. DISK IS NEARLY FULL (~1.5 GiB free): do not download models or create worktrees; clean any large temp artifacts you produce.

## Branch setup (do this first, carefully)
1. `git checkout -b feat/meet-5-recorder-ui` (from current HEAD = feat/meet-4-meeting-catalogue).
2. `git merge feat/meet-1-audio-assets` then `git merge feat/meet-2-transcribe`. Expected conflicts are trivial:
   - `packages/server/src/ableOidc.test.ts`: all three branches contain the identical code line `expiresAt: new Date(Date.now() + 60_000)`; conflicts are comment-only. Resolve keeping MEET-2's comment wording (PAT validation uses the database clock, not the injected OIDC clock).
   - Possible add/add in `packages/sdk/src/index.ts` export lines — keep BOTH exports, watch for duplicated re-export lines (known trap).
   - `_brief.md`/`_report.md` conflicts: resolve by DELETING these files (they're being stripped from all branches).
3. After the merges, run `pnpm build:libs` (semantic-conflict check) before starting feature work.

## What you're building
The real `meeting` block UI, replacing MEET-4's placeholder shell (registered via registerArtifactKit — find it and replace its renderer; keep registration/drift-guard structure intact).

### Contracts you MUST follow (already merged into your branch)
- **Block props (MEET-4 contract, in `_report.md` at git ref 1f97ba06 — read `git show 1f97ba06:_report.md`):** props `status ('idle'|'recording'|'processing'|'done')`, `audioChunks [{assetId, durationMs, startedAtMs?}]` (startedAtMs = offset from meeting start), `transcript [{startMs, endMs, text}]` (offsets relative to meeting start, ms), `summary` (plain string), `startedAt` (epoch ms), `title?`. Arrays replace wholesale — batch and serialize your writes (single writer: the recording client). Manual notes = ordinary CRDT child blocks; MEET-4's shell stored them — render them as an editable notes region (children editing inside a kit block: see how form/KitFrame handles nested content; follow useKitLock + editor.readOnly semantics, BlockEditor.tsx ~:2429-2449).
- **Transcription API (MEET-2):** `client.transcribeAsset(assetId, pageId)` → `{text, segments?[{start,end,text}] (SECONDS), durationMs}`. Convert segment seconds → ms and offset by the chunk's startedAtMs when appending to `transcript`. Errors: 400 (unconfigured → show actionable copy pointing at Settings → AI), 403 (guest/paid gate), 404, 502. LocalDataClient rejects AI — degrade gracefully (recording + notes still work; transcription affordance disabled with clear copy).
- **Audio upload (MEET-1):** audio mimes webm/ogg/mpeg/mp4/wav accepted by the asset store; 10 MiB/asset cap. Upload chunks via the assetBridge (ui/src/lib/assetBridge.ts; ImageBlockView.tsx is the bytes↔objectURL reference).

### Recording behavior
- getUserMedia + MediaRecorder. **Restart MediaRecorder per ~45s chunk so every chunk is a standalone playable file** (do NOT use one recorder with timeslice — those blobs aren't independently decodable). Prefer `audio/webm;codecs=opus`, probe with MediaRecorder.isTypeSupported and fall back (Safari → audio/mp4).
- Controls: record / pause / resume / stop; elapsed timer; per-chunk progress. Status prop transitions idle→recording→processing→done.
- Per chunk pipeline: finalize blob → upload asset → append to audioChunks prop → transcribeAsset → append converted segments to transcript prop. Transcript grows during the meeting. Chunk upload MUST succeed/retry even if transcription fails (flag untranscribed chunks, offer per-chunk retry). Exponential backoff; never lose audio; ephemeral state (recorder handle, retry queue, errors) in React state, durable state in props within editor.doc.transact.
- Mic-permission denied → graceful copy, no crash. Playback: simple per-chunk <audio> playback from object URLs is sufficient for v1.

### Surfaces
- Slash-menu entry + icon for `meeting` (SlashMenu.tsx pattern ~:242-249).
- i18n ×4 (en/de/ja/zh — follow the formBlock namespace pattern), obe-* CSS in ui/src/index.css, VersionDiff label.
- Export serializers: minimal stub — transcript as timestamped paragraphs + summary text in exportBlocks.ts so exports don't break; full export work is MEET-7 (do not build audio export).
- a11y: controls labelled, recording status via aria-live, transcript selectable/copyable.

## Acceptance (each maps to a test; ui unit tests with mocked MediaRecorder/getUserMedia/assetBridge/client)
1. State machine incl. pause/resume and permission-denied path.
2. Chunking: recorder restarted per chunk; chunk blob uploaded; audioChunks appended in order with durations.
3. Transcription append: seconds→ms conversion + startedAtMs offset correct; failed transcription leaves chunk flagged + retryable; transcript ordering stable.
4. Props persistence through serialize round-trip; notes children render and stay editable per lock/readOnly semantics; read-only page → no recording controls active.
5. No-AI (LocalDataClient) and unconfigured (400) degradation copy.
6. Drift guards still green (registryCatalogue both directions), existing MEET-4 catalogue tests untouched.

## Definition of done
- `pnpm verify` green FOREGROUND (serialize with VITEST_MAX_WORKERS=1 if parallel flakes on money.test.ts — known host-load flake, do not modify that test).
- All committed; no push. Write `_report-meet5.md`: outcome, head sha, merge-resolution notes, criterion→test map, deviations, open questions. Terse.
- Do NOT produce Playwright captures (your sandbox can't launch Chromium; the manager handles captures at PR time).
- Never delete/weaken existing tests. If wedged after a real attempt, commit and report where.
