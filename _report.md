MEET-2 implemented and committed. Full verification is BLOCKED by host disk exhaustion (`No space left on device`); it is NOT green. No push. The implementation provides request-scoped asset transcription, independent audio configuration, OpenAI-compatible multipart backend, SDK client, access/paid gates, write-only credentials, and usage attribution.

Implementation commit: `69f01e0074451e11e58c370184649c24c1a6dbd2` (`feat(server,sdk): add asset transcription service and backend (MEET-2)`). Verification head: `5c0497889afe14d6e713ad12e02d6a8c47448546` (includes the OIDC fixture correction). The report is committed separately; final branch HEAD is reported in the handoff.

Verification (all commands foreground):

- MEET-2 focused suite: **10/10 passed**; server typecheck and changed-file lint passed.
- First `pnpm verify`: builds, generated-file check, all typechecks/lint, SDK **546**, UI **2319**, desktop **7**, and MCP contract tests passed. Server suite reported the expired OIDC fixture and mirror timeout; stopped that already-failed run after diagnosis. Server suite did not finish; end-to-end tests were not reached.
- Corrected OIDC fixture: **22/22 passed**. Mirror tests unchanged outside sandbox: **3/3 passed**.
- Second `pnpm verify` (outside sandbox): builds, generated-file check, all typechecks/lint passed; SDK money property test hit its five-second timeout under load (**545 passed, 1 timed out**). Unchanged SDK with `VITEST_MAX_WORKERS=1`: **546/546 passed**.
- Third `VITEST_MAX_WORKERS=1 pnpm verify` (outside sandbox): blocked rebuilding viewer by **ENOSPC**. `df -h .` reported **100% capacity, 133 MiB available** immediately afterward. No tests/assertions disabled, no timeouts increased.

Relevant foreground output:

```text
transcription.test.ts: Test Files 1 passed (1); Tests 10 passed (10)
ableOidc.test.ts: Test Files 1 passed (1); Tests 22 passed (22)
mirror.integration.test.ts (outside sandbox): Tests 3 passed (3)
SDK (VITEST_MAX_WORKERS=1): Test Files 32 passed (32); Tests 546 passed (546)

Second full attempt:
FAIL src/money.test.ts > round-trips 1e6 seeded random amounts with zero drift
Error: Test timed out in 5000ms.

Third full attempt:
Failed to write file in packages/ui/src/export/vendor/openbook-viewer.js
Caused by: No space left on device (os error 28)
ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL @book.dev/ui build
Exit status 1
```

Resume after freeing host disk capacity: rebuild viewer/server/MCP via the normal `build:libs` stage and rerun foreground `VITEST_MAX_WORKERS=1 pnpm verify` outside the sandbox. The last failed build may have left an incomplete ignored viewer artifact. Do not treat partial checks as full verification. Logs remain at `/tmp/meet2-verify.log`, `/tmp/meet2-verify-final.log`, and `/tmp/meet2-verify-serial.log`.

Criterion → test map (`packages/server/src/transcription.test.ts`):

| Criterion | Test |
| --- | --- |
| Config persistence, write-only keys, blank/omitted preserve, replacement, null clear | round-trips and redacts keys… |
| Deterministic mock; route success; usage row | returns the deterministic mock result… |
| Cloud paid gate independent of chat provider | denies cloud to claimed-instance guests… |
| Authenticated cloud, unknown cost, sanitized errors | allows authenticated cloud transcription… |
| Local default, ungated local, cloud precedence | defaults to local… |
| Missing/unreadable/unreferenced/unrelated assets, invalid/missing pages → 404 | returns identical 404s… |
| Off/unconfigured/local unavailable → actionable 400; malformed body | gives actionable 400s… |
| Multipart/auth/URL normalization/exact bytes/timing | uses multipart verbose JSON… |
| Text-only JSON, validated segments, duration fallback, provider failure | accepts text-only JSON… |
| HTTP SDK and LocalDataClient rejection | HTTP client posts the contract… |

MEET-5 contract:

- `DataClient.transcribeAsset(assetId: string, pageId: string): Promise<AiTranscriptionResult>`; HTTP `POST /api/ai/transcribe` with JSON `{assetId, pageId}`. Assets must already exist and reference that page; the caller must read both. Stored MIME is passed through, with no MIME allowlist dependency.
- Result `{text: string, segments?: Array<{start: number, end: number, text: string}>, durationMs: number}`. Segment offsets use **seconds**; duration uses **milliseconds**. Duration comes from the backend, otherwise maximum segment end, otherwise `0` (unknown). No queue, streaming, persistence, or page mutation.
- Errors: `400` missing arguments or disabled/unavailable local configuration (points to Settings → AI); `404` missing/unreadable/unrelated asset/page; `403` claimed-instance guest using cloud; `502` upstream failure with sanitized message. Existing application authentication/request gates still apply.
- `AiConfig.transcription?: {provider: 'off' | 'local' | 'openai-compat', baseUrl?: string, model?: string, apiKey?: string | null, apiKeySet?: boolean}`. Save through existing `aiSetConfig`, read through `aiStatus`. Missing section means local; `off` explicitly disables. Omitted section on save preserves prior audio settings. Present section replaces settings while preserving an omitted/blank key. Nonempty key replaces (trimmed); `null` clears. Responses remove keys and expose only `apiKeySet`; that flag is never persisted.
- Explicit `openai-compat` opts into the paid gate, even for a user-managed local URL. Defaults: `https://api.openai.com`, `whisper-1`. No chat key/config inheritance. Optional bearer key; base URL can include `/v1` and/or trailing slash. One multipart path requests `verbose_json` plus segment timestamps. JSON responses without segments are accepted. No automatic retry/downgrade on a provider rejecting verbose JSON.

MEET-3 contract:

- Implement `TranscriptionEngine` from `packages/server/src/ai/providers.ts`: `transcribe(bytes: Uint8Array, opts?: TranscribeOptions): Promise<AiTranscriptionResult>`. Options: `{filename?: string, mime?: string, signal?: AbortSignal}`. Respect cancellation; return the units above.
- Inject the optional third `AiService` constructor argument: `() => Promise<TranscriptionEngine | null>`. Resolve/start the managed local backend lazily. Return `null` when unavailable. MEET-3 owns backend process/model lifecycle; MEET-2 does not dispose the injected engine per request.
- Reuse `new OpenAiCompatEngine(baseUrl, model)` for a local OpenAI-compatible server. The local resolver result is classified `local` and is ungated; omitted transcription config selects this resolver. `transcriptionBackend()` captures one backend/provider/model per request before the paid gate. Explicit `off` disables; explicit cloud wins; local resolver comes next; chat `mock` supplies deterministic fallback for tests/demos; otherwise actionable `400`.
- `AiEngine.transcribe` is optional, so chat-only engines need no changes. The endpoint never calls chat readiness/model probes.
- Successful requests log one `kind: 'transcribe'` row under `openai-compat`, `local`, or `mock` with server-resolved principal/model. Audio token counts are `0` (unreported); cloud cost is `null`, local/mock cost `0`. No audio-minute pricing/schema migration. The local model label is configured `transcription.model` or `local`.

Verification follow-up: the first sandboxed run found an existing OIDC PAT fixture expired on September 8, 2026. Commit `5c049788` makes its expiry relative to the real database clock, preserving every assertion; all 22 OIDC tests passed afterward. Existing mirror integration tests also hit filesystem-watcher `EMFILE` errors and a timeout in the sandbox. All 3 passed unchanged outside the sandbox. Stopped the already-failed sandboxed run and restarted full foreground verification outside the sandbox. No tests or assertions disabled, no timeout increased.

Deviations/limitations: Local implementation remains the planned MEET-3 hook; no MEET-1 MIME changes. Cloud errors do not trigger a silent local fallback. Tests use mocked upstream fetch, not a live paid service. Backend timeout is five minutes. No existing tests deleted or weakened.

Open blocker: host disk capacity; full verification and end-to-end checks remain outstanding. No interface questions. MEET-3 should wire its resolver at AiService construction; MEET-5 should render `apiKeySet` and surface the actionable errors.
