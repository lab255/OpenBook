# MEET-3 — Finley report

Implemented the default local transcription path, managed process cleanup, model download/status, and the minimal Settings → AI affordance. No cloud key is required. Full foreground `pnpm verify` passed, as did native HTTP and real-speech smoke checks. Nothing was pushed.

- Branch: `feat/meet-3-local-whisper`, stacked on `feat/meet-2-transcribe` at `bbccdbc1`.
- Implementation HEAD: `0a2adfa9f6d472941b7494a03c8a34a7a0901b18`. The subsequent report-only commit records verification; its SHA is supplied in the worker response.
- Merge MEET-2 before MEET-3.

## Runtime choice and model

Chose the optional **whisper.cpp `whisper-cli` system executable**, plus **FFmpeg** for browser WebM/MP4/Ogg and other audio inputs. No new npm native addon or mandatory install/build hook is introduced. Compared with [smart-whisper's native Node addon](https://github.com/JacobLinCool/smart-whisper), the subprocess approach avoids Node ABI coupling and addon build failures in macOS/Linux CI. Compared with a persistent whisper-server, it needs no port allocation, readiness polling, or resident model memory. The cost is loading the model for each recording and requiring host-installed binaries.

The [upstream whisper.cpp CLI](https://github.com/ggml-org/whisper.cpp/tree/master/examples/cli) supports JSON output. Its millisecond offsets become API segments in seconds; their final endpoint supplies `durationMs`, following MEET-2's segment-derived timing fallback. FFmpeg normalizes input to mono 16 kHz PCM WAV. The server spawns commands directly without a shell, uses private temporary directories, ignores caller filenames, kills work on abort/shutdown, and removes scratch files after children close.

Default: **multilingual Whisper base**, `ggml-base.bin`, approximately **142 MiB**. It is a smaller download and uses less memory than small/medium models, with lower accuracy on noisy speech, accents, and difficult multilingual recordings. Language detection is automatic. Model bytes are never committed.

Setup:

1. Install whisper.cpp (`whisper-cli`) and FFmpeg on the server host using the [upstream build instructions](https://github.com/ggml-org/whisper.cpp#quick-start) or the host package manager.
2. Make both executables available on the server's PATH. Alternatively set `OPENBOOK_WHISPER_BIN` and `OPENBOOK_FFMPEG_BIN` to executable paths before starting OpenBook.
3. In Settings → AI, select **Download Whisper base**. The existing authenticated model-download flow downloads into `OPENBOOK_MODELS_DIR`, or the server's existing default models directory. The local resolver discovers the completed model without restart.
4. Local is the transcription default even when chat is off. Explicit cloud configuration still takes precedence, then local, then the existing mock fallback. Explicit transcription off stays off.

## Criterion → test map

| Acceptance | Evidence |
| --- | --- |
| 1. Native local POST, no cloud keys, result with segments | `transcription.test.ts`: `native whisper: POST transcribes synthesized WAV with no cloud keys`. Explicitly gated by `OPENBOOK_TEST_WHISPER=1`; synthesizes a 32 KB WAV in memory and asserts non-error result shape. **Passed in a separate opt-in native run** with temporary binaries/model; default verification still skips it explicitly. An additional real-speech sample returned nonempty text and timed segments. |
| 2. Missing runtime/model → null, fallback, actionable 400 | `ai/whisper.test.ts`: missing model/executable and discovery-without-restart test. `transcription.test.ts`: managed resolver fallback and aiStatus test; existing off/unavailable/cloud-precedence tests retained. |
| 3. Abort cancels in-flight local inference | `ai/whisper.test.ts`: actual child-process cancellation and disposal tests; both verify the child is gone and scratch directory removed. Also tests pre-aborted work and process failures. |
| 4. Usage provider local, cost 0 | `transcription.test.ts`: local usage/download test asserts `provider: local`, `model: ggml-base.bin`, `kind: transcribe`, `cost: 0`. |
| 5. Foreground verify, no native dependency | Verification results below. |

Additional tests cover exact input-byte handling, timestamp normalization, malformed JSON shape, empty transcription, temporary-file cleanup, owner-route model download, and preventing Whisper downloads from becoming the llama chat model. No existing tests were deleted.

Native smoke command after installing the optional binaries/model:

```sh
OPENBOOK_TEST_WHISPER=1 OPENBOOK_MODELS_DIR=/absolute/path/to/models \
  pnpm --filter @book.dev/server exec vitest run src/transcription.test.ts
```

## Verification

- Focused tests: **17 passed, 1 explicitly skipped** across the transcription and whisper suites.
- Implementation commit hooks: ESLint, SDK/server/UI typechecks, and conventional commit validation passed.
- Opt-in native HTTP smoke: **1 passed** (12 unrelated tests skipped by the name filter), 11.11 seconds. Temporary CPU-only whisper.cpp build at `60c0be6ac8fa71b1a2ae2dd938a31a34a508e774`, FFmpeg reporting version 6.0, and multilingual base on macOS arm64.
- Real-speech smoke: the upstream temporary `samples/jfk.wav` produced the expected “ask not” text, a segment spanning 0–10.5 seconds, and `durationMs: 10500`. No sample/model bytes were added to git.
- Native build tools, binaries, source, model, and scratch files were removed after the smoke runs. The isolated downloads/build occupied roughly 400 MiB and never entered the server's default PATH or model directory.
- First foreground `pnpm verify` inside the macOS sandbox: all earlier stages passed; server tests finished with 98 files / 1,342 tests passing, 7 skipped, and one mirror integration failure accompanied by 14 `EMFILE` filesystem-watch errors. The file-descriptor soft limit was already 1,048,575; a standalone `fs.watch` on a new empty temporary directory also emitted `EMFILE` inside the sandbox, confirming the environment restriction.
- The unchanged mirror integration suite passed all 3 tests outside the sandbox (14.43 seconds). No existing tests or resource limits were changed.
- Full foreground `pnpm verify` rerun outside the sandbox: **PASSED, exit 0**, with no optional Whisper runtime/model installed in the default environment. Builds, generated-file checks, typechecks, lint, all package tests, and end-to-end checks passed. SDK: 546 tests; UI: 2,319; app: 7; server: 99 files, 1,343 tests passed and 7 explicitly skipped. Server end-to-end: 256 checks; MCP end-to-end: 70 checks. The server unit suite took 3,397.77 seconds.

Local verification artifacts: [verify-green.log](/Users/eliot/.bb/thread-storage/meet3-verification-gl8tvey3/verify-green.log), [verify-sandbox-failure.log](/Users/eliot/.bb/thread-storage/meet3-verification-gl8tvey3/verify-sandbox-failure.log), [native-http.log](/Users/eliot/.bb/thread-storage/meet3-verification-gl8tvey3/native-http.log), [native-speech.log](/Users/eliot/.bb/thread-storage/meet3-verification-gl8tvey3/native-speech.log).

## Deviations and open questions

- Used the brief's permitted optional executable alternative, not an npm `optionalDependencies` entry. CI requires neither whisper.cpp nor FFmpeg. Product packaging/distribution of those binaries remains a follow-up; Settings explicitly explains missing runtime requirements.
- The manager supplies status/disposal through a fourth optional `AiService` constructor argument, preserving the existing third-argument resolver contract and existing callers.
- No native runtime/model was installed into the workspace or globally. The default suite explicitly skips native inference; the separate opt-in run passed using temporary executables/model. Linux and GPU backends were not exercised here.
- Model downloads reuse the existing single-download slot and progress surface. The local model is fixed to base for this milestone; selecting larger local models and broader Settings polish remain outside MEET-3.
- No blocking product questions. Native platform packaging and speech-quality evaluation remain useful follow-up work.
