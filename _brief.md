# MEET-2 — Transcription service + OpenAI-compatible backend

You are a Worker agent on the OpenBook team. Work ONLY in this worktree (`/Users/eliot/Workspaces/OpenBook-wt-meet-2`, branch `feat/meet-2-transcribe`). Do NOT push. Do NOT touch main. Conventional commits (`feat(server,sdk): … (MEET-2)`), committed incrementally.

## Task
Add a transcription capability to the AI layer. No engine has audio today. Key anchors (recon-time line hints — trust the code):
- Engines: `packages/server/src/ai/providers.ts` — `MockEngine` :108, `OpenAiCompatEngine` :196, `AnthropicEngine` :620, factory `createEngine` :821.
- Config: `AiConfig` `packages/sdk/src/ai.ts:66`, persisted in DB `settings` key `'ai'` (`ai/service.ts:115-123`); API keys are write-only over the wire (`resolveKey` service.ts:31-37 — blank keeps, null clears). Preserve those semantics for any new key field.
- Routes: `packages/server/src/ai/routes.ts` — `aiComplete` :137 is the request-scoped shape to mirror; paid-provider gate `requirePaidInferenceAccess` :412; usage logging `ai/usage.ts`.
- Access: default-deny via `access.ts` (`requireAccess`); unreadable → 404.

## Design (contract for MEET-3 local whisper and MEET-5 UI — keep the interface clean)
1. Extend `AiConfig` with a `transcription` section: `{ provider: 'off' | 'local' | 'openai-compat', baseUrl?, model?, apiKey? }`. **Resolution order: explicit cloud config > local (arrives in MEET-3; stub the enum/dispatch now) > clear actionable error pointing at Settings → AI.** Local is the product default — cloud only when explicitly configured.
2. New `transcribe` capability speaking the OpenAI-compatible `POST /v1/audio/transcriptions` multipart shape (works for OpenAI cloud and local servers like faster-whisper/speaches — ONE code path). Request `verbose_json`/segments where available.
3. Server route (under ai/routes.ts): POST taking `{ assetId, pageId }` (bytes already in the asset store — fetch via the store with the caller's read access enforced), returning `{ text, segments?: [{start, end, text}], durationMs }`. Request-scoped like aiComplete. Do NOT build a job queue.
4. Cloud transcription goes through `requirePaidInferenceAccess`; `local` will be ungated. Log usage rows.
5. sdk: `transcribeAsset(assetId, pageId)` on the HTTP client (pattern near `client.ts:1571`). `LocalDataClient` (`server/localClient.ts:888-932`) keeps rejecting AI calls — extend its rejection list to the new method.

## Acceptance (each maps to a test)
- MockEngine grows a deterministic `transcribe` for tests.
- Unit tests: config round-trip incl. write-only key semantics; route happy path via mock; paid-gate enforced for cloud provider; 404 on missing/unreadable asset; `off`/unconfigured → actionable 4xx error.
- NOTE: audio MIME allowlist work is MEET-1 (parallel branch) — do not depend on it; transcribe takes the asset bytes regardless of stored MIME.

## Definition of done
- `pnpm verify` green FOREGROUND in this worktree, output in report. (Provisioned; artifact-failure symptom → rebuild viewer/server/mcp bundles.)
- All committed, not pushed. Write `_report.md` (outcome first, head sha, criterion→test map, interface summary for MEET-3/MEET-5 consumers, deviations, open questions) and reply with it. Terse.

## Rules
Never poll external state. Stuck after a real attempt → commit + report where wedged. Never delete/weaken existing tests (reviewers check the commit RANGE).
