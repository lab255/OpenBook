PASS — HEAD `8ded61a09d6948944e37aaa8bf9fb29f5ced6ac8`. Three conventional commits; no push.

| Criterion | Commit / evidence |
| --- | --- |
| F3 current-pin model readiness; F6 abort + orphan retry | `d17de5f1`, `8ded61a0`; `pinnedDownload.test.ts`, `whisper.test.ts`, `serviceDownload.test.ts`, `transcription.test.ts` |
| Fresh enable → ready, ZIP/tar.xz, DLL directory, pin upgrades | `59fb1459`; `runtime.test.ts` fixture integration |
| Corrupt/truncated/invalid archive preserves old install | `59fb1459`; `runtime.test.ts`; synced generation + atomic receipt publication |
| Env → managed → PATH; Windows PATHEXT | `59fb1459`, `8ded61a0`; `runtime.test.ts`, existing whisper process tests |
| Enable/download/startup provisioning, disposal cancellation | `59fb1459`; `serviceDownload.test.ts`, `runtime.test.ts` |
| Per-tool status/versions; real darwin-arm64 partial support | `59fb1459`; `OPENBOOK_TEST_RUNTIME=1 pnpm --filter @book.dev/server exec vitest run src/ai/runtimeNative.test.ts` PASS (real pinned model download) |

Validation: foreground `pnpm verify` PASS (exit 0): server 1,431 passed / 8 skipped; SDK 580, UI 2,405, app 9 passed; end-to-end 256 server + 70 MCP passed. Ran outside the sandbox because a minimal recursive watcher reproduces sandbox-only EMFILE; unchanged mirror tests pass outside it. Existing tests retained; legacy readiness/concurrency fixtures now require verified receipts, with all prior assertions preserved.

Dependencies added: none. Uses system unzip on Unix, tar/xz on Linux, built-in tar for Windows ZIPs, and macOS xattr. Failed extraction reports an error. Previous installation generations are retained.

SDK-only addition: optional `transcription.runtime` supplies WSP-3 with typed per-tool status and desired/installed versions; `modelPresent` unchanged. No UI changes.

Open question (pre-existing, nonblocking): trusted native whisper-cli builders for macOS/Linux and native ARM ffmpeg provider. Recommend retaining typed unsupported pins until owner selects trusted builds. Full ready flow is fixture-tested; native Windows execution was not available on this host.
