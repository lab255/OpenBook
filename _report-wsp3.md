PASS — HEAD ec2a00a1e927295381121d4883a94efade418126. One-click transcription implemented and all requested states tested. Foreground pnpm verify exited 0. Three conventional commits; no push. Brief/report untracked.

| Criterion | Commit | Evidence |
|---|---|---|
| Truthful provisioning, failures, overrides, stale model | a501e57b | runtime.test.ts: 15 passing |
| Single enable/update action, compact stages, ready success | 00028e3c | AiSettings.test.tsx: 20 passing |
| Four locales; meeting points to one-click setup | 00028e3c | i18n check; zero manual-install-copy matches |
| Fresh setup, progress, ready, unsupported, updates, failure, override in browser | ec2a00a1 | ai-transcription.spec.ts: 6 passing (52.8s) |
| Full foreground verification | all | pnpm verify: exit 0; SDK 580, UI 2412, desktop 9, server 1439 passing; server e2e 256 / MCP e2e 70 checks passing |

State coverage: enable; runtime provisioning; model percentage progress; partial unsupported (informational); runtime/tool error; model error; request rejection/retry; stale model; stale runtime; env override valid/invalid; ready with action hidden. Unit and browser fixtures avoid downloading release artifacts; server fixtures exercise real archive extraction and receipts.

Strings per locale (en/de/ja/zh, each): +13 / −5 keys; 1 existing meeting message changed. No new placeholder mismatches. Existing unrelated locale gaps remain (de 671; ja/zh 675).

Scope exception: existing SDK/server status lacked provisioning/failed, per-tool override/availability, and modelUpdateAvailable. Added these fields; no endpoint change. Wrapped runtime download errors with tool identity while preserving cancellation.

Defaults: reuse aiDownloadModel; retain provider selection; hide action when ready/current; show override variable names, never executable paths; treat an existing stale/legacy model file as an update; unsupported tools remain informational and show env-variable escape hatch. No open product questions.

Capture-worthy: fresh enable; runtime provisioning; 50% model download; partial unsupported; stale-receipt update; ready success.

Execution notes: initial sandboxed verify was stopped after mirror.integration.test.ts reported a failure in the live-edit/watcher case; all 3 mirror tests passed unchanged outside the sandbox (15.56s). Full foreground rerun outside sandbox passed (server suite: 106 files passed, 1 skipped; 1439 tests passed, 8 skipped; 3712.33s). Existing skips unchanged. Initial browser attempt was blocked by macOS Chromium sandbox restrictions; rerun outside sandbox with a fresh test server. Commit hooks passed; Git emitted a packed-refs.lock sandbox warning after each successful commit. No existing tests removed or weakened.

Logs: `/tmp/wsp3-verify-unsandboxed.log`, `/tmp/wsp3-browser.log`, `/tmp/wsp3-mirror.log`. Working tree contains only the untracked brief/report.
