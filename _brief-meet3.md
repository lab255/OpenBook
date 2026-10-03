# MEET-3 — Local whisper engine (default transcription path)

You are Finley, an OpenBook Worker agent. Work in THIS worktree (`/Users/eliot/Workspaces/OpenBook-wt-meet-2`). Do NOT push. Conventional commits (`feat(server): … (MEET-3)`), committed incrementally. Disk headroom is ~6 GiB — prefer a SMALL whisper model for tests/default; clean temp artifacts.

## Branch setup
`git checkout -b feat/meet-3-local-whisper` from current HEAD (feat/meet-2-transcribe @ bbccdbc1). This stacks on MEET-2; merge order to main is MEET-2 first.

## Task
Implement the LOCAL transcription backend so transcription works with zero cloud keys — this is the product DEFAULT (owner directive). MEET-2 built the exact seam for you; its contract:

- Implement `TranscriptionEngine` from `packages/server/src/ai/providers.ts`: `transcribe(bytes: Uint8Array, opts?: {filename?, mime?, signal?}): Promise<AiTranscriptionResult>` ({text, segments?[{start,end,text}] seconds, durationMs}). Respect AbortSignal.
- Inject via the optional third `AiService` constructor argument `() => Promise<TranscriptionEngine | null>` (resolve/start the managed backend lazily; return null when unavailable). MEET-3 owns process/model lifecycle; wire the resolver at AiService construction in server startup.
- Resolution order already implemented by MEET-2: explicit cloud > your local resolver > mock > actionable 400. Local is ungated (no paid gate). Usage rows log kind 'transcribe' provider 'local', cost 0.

## Implementation guidance
- Follow the `LlamaEngine` optional-native-dep pattern (providers.ts ~:468, node-llama-cpp): whisper binding as an OPTIONAL dependency — evaluate smart-whisper vs whisper.cpp node addons vs spawning a whisper.cpp/whisper-server binary; pick fewest native-build headaches across mac/linux CI and justify in your report. An OpenAI-compatible local server (reusing `new OpenAiCompatEngine(baseUrl, model)` against a managed localhost process) is also acceptable if it's the most robust path.
- Model acquisition reuses the existing model-download flow (ai/service.ts startDownload pattern, OPENBOOK_MODELS_DIR, server.ts ~:437). Default model: whisper base or small multilingual (ggml); state the size/quality trade-off. Do NOT bundle model bytes in git.
- Absence of the native dep / model must degrade to a clear error pointing at Settings → AI model download — never a crash. CI (`pnpm verify`) must be green WITHOUT the native dep installed (mock/skip pattern like llama).
- Settings → AI: expose local transcription state (model present/absent, download affordance) through the existing aiStatus/config surfaces; keep UI changes minimal — MEET-5's Settings polish is out of scope.

## Acceptance (each maps to a test)
1. With the binding available + a model present and no cloud config, POST /api/ai/transcribe returns real text+segments for a small fixture (check in a fixture only if <100 KB; else synthesize audio in the test and assert non-error shape). Gate this test behind an env flag or dep-presence check so CI without the dep skips it EXPLICITLY (visible skip, not silent).
2. Resolver returns null when dep/model missing → route falls through per MEET-2 order; actionable 400 text mentions Settings → AI.
3. AbortSignal cancels an in-flight local transcription.
4. Usage row: provider 'local', cost 0.
5. `pnpm verify` green FOREGROUND (VITEST_MAX_WORKERS=1 if the money.test.ts load flake appears — do not modify that test), WITHOUT the native dep in the default run.

## Done
All committed, not pushed. Write `_report-meet3.md`: outcome first, head sha, dep choice + rationale, model default + trade-off, criterion→test map, deviations, open questions. Delete nothing from existing tests. Never poll external state; wedged after a real attempt → commit + report.
