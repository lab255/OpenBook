# WSP-3 fixes — PASS

HEAD: `15db010f3b4c33e3461d4a226b14a2b846c8cf77`
Commit: `fix(transcription): apply reviewed setup and status fixes`
No push. Brief/report files excluded from commit.

- F1 PASS — `LocalTranscription.tsx:32,61`: exact actionable predicate and button guard.
- F2 PASS — SERVER variant, `runtime.ts:75`: provisioning set before binary lookup; cleared on continue. Skip/override tests pass.
- F3 PASS — `runtime.ts:88`: unwrap Error cause for detail; two existing error assertions updated for unwrapped failures.
- F4 PASS — `LocalTranscription.tsx:48,57,64`: localized stageLine for model/tool/error lines; modelReady in en/de/ja/zh; ja/zh full-width colon.
- F5 PASS — meeting unconfigured copy updated consistently in en/de/ja/zh (en.ts:1148).
- F6 PASS — `runtime.test.ts:217`: abort during gated fetch rejects, clears stage to missing, leaves no detail.
- F7 PASS — `ai-transcription.spec.ts:66`: real status pipeline, no status mock or clicks; both tool prefixes and button-or-ready asserted.
- F8 PASS — `LocalTranscription.tsx:9`: extracted toolLabel(tool, name, t).
- F9 PASS — `whisper.ts:123,130`: reuse runtime status; simplified detail predicate.

Validation (foreground):

- UI AiSettings/LocalTranscription: 20 passed (coverage lives in AiSettings.test.tsx; no separate LocalTranscription test file).
- Server runtime/whisper/serviceDownload/transcription: 47 passed, 1 existing opt-in native Whisper test skipped. Initial traversal-error assertion mismatch corrected; runtime rerun 16/16 passed; other three suites passed initially.
- `pnpm run build:libs`: PASS.
- `pnpm --filter @book.dev/web exec playwright test e2e/ai-transcription.spec.ts`: 7/7 passed, 41.5s, no retries in final run. Initial sandbox blocked Chromium; interrupted retry reused a stale server and timed out. Final run used elevated launch permissions and a fresh test-managed server.
- UI/server typecheck + lint: PASS. Final runtime test lint: PASS.
- Commit hooks: staged ESLint, server/UI/web typechecks, commitlint PASS. Git printed a packed-refs.lock sandbox warning; commit/HEAD verified and tracked worktree clean.
- `git diff --check`: PASS.
