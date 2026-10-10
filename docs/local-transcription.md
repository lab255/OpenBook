# Local transcription

OpenBook transcribes recordings locally by default, without a cloud API key. The server uses the optional whisper.cpp `whisper-cli` executable and FFmpeg. Neither executable nor model weights are bundled with OpenBook; normal CI skips native inference explicitly.

## Enable local transcription

1. Open **Settings → AI** and select **Enable local transcription** in the audio section. This one action provisions the supported runtime binaries and the Whisper base model on the OpenBook server; no cloud API key is needed.
2. Follow the separate Whisper runtime, FFmpeg, and model progress rows. Setup downloads pinned artifacts, verifies their SHA-256 checksums and sizes, then installs the runtime into `<dataDir>/bin`. A completed generation is published with a receipt only after verification and extraction; partial downloads are not treated as ready.
3. Wait until the runtime and model are ready, then transcribe a recording. If a stage fails, Settings identifies it and lets you retry Enable. Existing recordings and manual notes remain available.

Model downloads go to `OPENBOOK_MODELS_DIR` when set, otherwise `<dataDir>/models` (default data directory: `~/.openbook`). Moving the model directory does not move the managed runtime. The completed model is discovered without restarting.

The default model is multilingual Whisper base (`ggml-base.bin`, approximately 142 MiB), with automatic language detection. It trades some accuracy on noisy speech, accents, and difficult multilingual recordings for a smaller download and lower memory use than larger models. Enabling transcription does not change the selected chat model.

### Updates and platform availability

Receipts identify the pinned artifact generation. When an OpenBook update changes a runtime or model pin, the old receipt no longer counts as current. With local transcription enabled, loading the saved AI configuration automatically starts re-provisioning; Settings also offers **Update local transcription** for stale installations. Current artifacts are reused, and replacements are verified before becoming ready.

Availability is per tool and platform. The current manifest has no managed Whisper CLI for macOS or Linux, and no managed FFmpeg for Apple Silicon; Settings reports these as unsupported. Enable can still provision the model and any supported tool, and existing user or Homebrew runtimes can satisfy the remaining requirements through PATH. The planned switch to OpenBook's own signed release binaries (WSP-7) is not active yet.

Explicit cloud transcription configuration takes precedence over local inference. Otherwise the server tries local transcription, then the deterministic mock fallback only when the chat provider is mock. Local transcription works with chat disabled; explicitly disabling transcription still disables it. Missing executables or model weights produce an actionable error pointing to Settings → AI.

## Advanced overrides and existing installations

For custom builds or a platform without managed binaries, install whisper.cpp and FFmpeg using your trusted package manager or the [whisper.cpp build instructions](https://github.com/ggml-org/whisper.cpp#quick-start). Existing Homebrew or user installations work when `whisper-cli` and `ffmpeg` are on the server process's PATH. On macOS, the desktop sidecar appends `/opt/homebrew/bin` and `/usr/local/bin` after inherited PATH entries.

For explicit custom executable paths, set these variables before starting the server or desktop app:

```sh
export OPENBOOK_WHISPER_BIN=/absolute/path/to/whisper-cli
export OPENBOOK_FFMPEG_BIN=/absolute/path/to/ffmpeg
```

Resolution is **environment override → current managed runtime → PATH**, independently for each tool. An explicit override skips managed provisioning for that tool; an invalid override does not fall through to another executable. Use **Enable local transcription** for the verified model and any remaining managed tool. You do not need overrides for a provisioned runtime.

## Processing and limits

FFmpeg converts recordings to mono 16 kHz PCM WAV. Whisper loads the model for each job and returns text plus segments in seconds; `durationMs` is the rounded maximum segment endpoint in milliseconds. Each job uses a private temporary directory. Cancellation and server shutdown kill active child processes, wait for them to close, and remove scratch files.

Each server permits at most **two local transcription jobs at once**, shared across all clients. There is no queue. Busy requests return HTTP **429** with `Retry-After: 5`. Permits remain held through temporary-file cleanup and are released on success, failure, or cancellation.

The transcription route also allows **six local requests per socket IP per 60-second fixed window**. Excess requests return HTTP **429** with `Retry-After: 60`. Client-supplied forwarding headers do not change this key; clients behind a reverse proxy may share its socket IP budget. The limit applies only when the resolved backend is local; cloud and mock backends are unaffected.

## Native smoke test

After enabling local transcription, run from the repository root against the server's data directory:

```sh
OPENBOOK_TEST_WHISPER=1 \
OPENBOOK_TEST_DATA_DIR=/absolute/path/to/server-data \
VITEST_MAX_WORKERS=1 \
pnpm --filter @book.dev/server exec vitest run src/transcriptionNative.test.ts
```

Set `OPENBOOK_MODELS_DIR` too if the model directory is relocated. The provisioned case reopens `<dataDir>/bin` using its generation receipts, clears binary overrides and PATH, and exercises the HTTP transcription route with a synthesized WAV. The companion case retains the ordinary environment/managed/PATH resolver. Both require the real pinned model and its verification receipt, and assert response shape rather than speech accuracy. They do not download or modify the supplied installation.

Without `OPENBOOK_TEST_WHISPER=1`, both native cases are explicitly skipped. With opt-in but no usable runtime/model, the unavailable case skips with a reason. A ready runtime that fails inference fails the test. Regular subprocess-fixture coverage exercises the same receipt-backed HTTP path without native dependencies, as well as concurrency, cancellation, failures, timestamp conversion, and cleanup.
