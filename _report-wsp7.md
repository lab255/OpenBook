# WSP-7 outcome

Activated the five shipped runtime pins from published `runtime-binaries-v1`.
All four release targets now have supported Whisper and FFmpeg entries. Linux
ARM64 and Windows ARM64 remain typed-unsupported through the existing fallback.
No push performed; no binaries committed. **Full `pnpm verify` is green in-turn**
(exit 0), including server and MCP end-to-end checks.

## Pins

Every asset below uses `https://github.com/lab255/OpenBook/releases/download/runtime-binaries-v1/<asset>`.
Versions carry `+runtime-binaries-v1` build metadata to advance receipt identity.

| Target / tool | Asset | SHA-256 prefix | ZIP bytes |
|---|---|---|---:|
| aarch64-apple-darwin / ffmpeg | `ffmpeg-7.1.1-aarch64-apple-darwin.zip` | `541e623ed21d` | 1,040,200 |
| aarch64-apple-darwin / whisper-cli | `whisper-cli-1.8.2-aarch64-apple-darwin.zip` | `9f62b22d4ffd` | 1,047,307 |
| x86_64-apple-darwin / whisper-cli | `whisper-cli-1.8.2-x86_64-apple-darwin.zip` | `f9518153a34a` | 1,204,029 |
| x86_64-pc-windows-msvc / whisper-cli | `whisper-cli-1.8.2-x86_64-pc-windows-msvc.zip` | `34cd1bbc8113` | 940,580 |
| x86_64-unknown-linux-gnu / whisper-cli | `whisper-cli-1.8.2-x86_64-unknown-linux-gnu.zip` | `d51266bfd47a` | 1,545,240 |

Release published at **2026-10-10T09:53:25Z**, draft=false, prerelease=true
(`gh release view`). Downloaded `assets.json` and `checksums.txt` with `gh release
download`; exact name→SHA-256 maps agree for all six ZIPs, including sources.
The checked-in JSON fixture is byte-for-byte the release inventory. Signature and
actual archive-byte verification rely on the manager's pre-publication review
specified in the brief; this task did not repeat platform signing/native execution.

## Criterion → commit / test

| Criterion | Commit | Evidence |
|---|---|---|
| Published pins, digests, sizes, all four Whisper targets + arm64 FFmpeg | `803c6780` | `runtimeManifest.test.ts`: exhaustive five-asset inventory match; four-target/two-tool structure checks |
| macOS supported; Windows static root executable, no DLL extraction | `803c6780` | Manifest inventory and Windows path assertions; all eight runtime entries supported |
| Generation bump re-provisions, preserves model readiness | `803c6780` | Versions gain release build metadata; existing `pinIdentity` includes version/URL/hash/size; mocked ZIP and tar.xz upgrades fetch again, replace receipts/installations, retain `modelPresent` |
| Linux/Windows ARM64 unsupported | `803c6780` | Mocked provisioning checks both tools on both unshipped targets; no corresponding release assets |
| Checksum verification, failed upgrade safety, mocked provisioning | `803c6780` | Existing `runtime.test.ts` + `pinnedDownload.test.ts`; 29 focused tests passed |
| Native download smoke remains conditional | `803c6780` | `runtimeNative.test.ts` unchanged, one intentional skip without `OPENBOOK_TEST_RUNTIME=1` |
| Activation date/tag, future flip procedure | `ef906896` | `docs/runtime-binaries.md` |
| Full verification and acceptance audit | Report commit | See validation below |

`runtime.ts`, `pinnedDownload.ts`, `whisper.ts`, `WHISPER_MODEL_PIN`, and receipt
schemas are unchanged. There was no existing global manifest generation counter;
per-pin version metadata supplies the explicit bump using the existing mechanism.

## Grep survivors

Acceptance command:

```sh
rg -n 'huggingface|ggml|github.com/ggerganov|evermeet|johnvansickle|gyan' packages/server/src/ai/runtimeManifest.ts
```

| Survivor | Reason |
|---|---|
| `evermeet.cx/ffmpeg/ffmpeg-7.1.1.zip` (Intel macOS) | Explicitly retained FFmpeg provider; v1 does not ship this build. SHA/size unchanged (`8d7917c1cebd…`, 25,458,015 bytes). |
| `johnvansickle.com/ffmpeg/releases/ffmpeg-7.0.2-amd64-static.tar.xz` (Linux x64) | Explicitly retained provider; v1 does not ship this FFmpeg. SHA/size unchanged (`abda8d77ce83…`, 41,888,096 bytes). Existing old-URL availability risk remains. |
| `gyan.dev/.../ffmpeg-8.1.2-essentials_build.zip` (Windows x64) | Explicitly retained provider; v1 does not ship this FFmpeg. SHA/size unchanged (`db580001caa2…`, 109,728,040 bytes). |
| `huggingface.co/ggerganov/whisper.cpp/resolve/<revision>/ggml-base.bin`, `ggml-base.bin` | Model weights in independent `WHISPER_MODEL_PIN`, not an executable prebuilt; unchanged. |
| `status: 'unsupported'`, `extractDir?: string` type declarations | Retained generic API for unshipped targets and existing/custom archive layouts; no macOS unsupported entries and no Windows Whisper `extractDir` value. |

Programmatic acceptance checks: five lab255 URLs, eight supported runtime pins,
zero Hugging Face/ggml-org/ggerganov URLs in `RUNTIME_MANIFEST`, no `Release`
extraction directory. The blanket “every URL is lab255” criterion is applied to
the five owned artifacts, per the brief's explicit FFmpeg exception. Sources ZIP
is inventory-only and is not a runtime download. Old URLs in the historical
`docs/runtime-binaries-manifest.patch` remain reference material, not active pins.

## WSP-5 overlap flags

Inspected `git log origin/docs/wsp-5-one-click-docs`: tip `1c2211f5`, test change
`92ee9665`, docs change `f2dc26fd` (base `bbf14ea6`).

- **Expected activation-section overlap:** `f2dc26fd` replaces the opening of
  `docs/runtime-binaries.md` with “activation remains pending (WSP-7)”. This task
  replaces that stale procedure with actual activation. During integration retain
  this task's activated date/tag/procedure and WSP-5's other documentation changes.
- **Avoided:** `docs/local-transcription.md` is untouched; its upstream/manual
  setup text is superseded by WSP-5's one-click rewrite. Do not reintroduce this
  worker's base text. No edits to WSP-5's other docs or native smoke tests.
- **No test-file overlap:** WSP-5 changes `transcriptionNative.test.ts` and
  `transcription.test.ts`; this task changes `runtime.test.ts` and
  `runtimeManifest.test.ts` plus its inventory fixture.

## Validation and gates

- Provisioning prerequisite command from the brief completed successfully.
- Focused explicit allowlist: `pnpm --filter @book.dev/server exec vitest run
  src/ai/runtimeManifest.test.ts src/ai/runtime.test.ts
  src/ai/pinnedDownload.test.ts src/ai/runtimeNative.test.ts` — **29 passed,
  1 conditional native skip**.
- Full verification: **PASS, exit 0**, `pnpm --filter open-book verify` (explicit
  root package selection invokes the complete checked-in `verify` pipeline;
  focused and e2e commands select named packages). Completed foreground in this
  turn, outside the filesystem sandbox: SDK **580**, UI **2,580**, app **9** tests
  passed; server **106 files / 1,443 tests passed**, **1 file / 8 tests skipped**
  (873.75s). MCP unit/contract suites passed. Server e2e **256 checks passed**;
  MCP e2e **70 checks passed**. Build, generated-file checks, typecheck, lint, and
  ESLint-rule tests all passed; existing build/lint warnings remain.
- Environment diagnosis: the first sandboxed run failed the mirror live-watch
  integration with `EMFILE: too many open files, watch`. A focused sandboxed
  rerun reproduced it (1 failed, 2 passed, 12 watcher errors); the same unchanged
  test outside the sandbox passed all 3 tests in 4.76s. Stopped the superseded
  sandboxed run and restarted the full gate outside the sandbox. No unrelated
  code/test changes or disabled checks.
- `bash scripts/check-no-private-keys.sh` and `git diff --check` passed.
- Proposed gate: **code**. **Security optional**: no download, extraction,
  verification, receipt, or model implementation changes; only pins, tests,
  inventory fixture and documentation. Pin provenance remains appropriate review
  material; Linux signing exemption and macOS non-notarization remain documented.
- Git commits succeeded. Git emitted a sandbox `packed-refs.lock` housekeeping
  warning after each commit; branch commits were verified with `git log`.
- `_brief.md` remains the original untracked task input. No push.

Verification logs retained in `/Users/eliot/.bb/thread-storage/wsp7-20261010-verification/`.
