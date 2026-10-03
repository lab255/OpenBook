# Local transcription

OpenBook transcribes recordings locally by default, without a cloud API key. The server uses the optional whisper.cpp `whisper-cli` executable and FFmpeg. Neither executable nor model weights are bundled with OpenBook; normal CI skips native inference explicitly.

## Setup

1. Install whisper.cpp and FFmpeg on the server host. Follow the [whisper.cpp build instructions](https://github.com/ggml-org/whisper.cpp#quick-start) or use your host package manager.
2. Put `whisper-cli` and `ffmpeg` on the server process's PATH. Alternatively, set executable paths before starting OpenBook:

   ```sh
   export OPENBOOK_WHISPER_BIN=/absolute/path/to/whisper-cli
   export OPENBOOK_FFMPEG_BIN=/absolute/path/to/ffmpeg
   ```

3. In **Settings → AI**, select **Download Whisper base**. This uses the existing authenticated model download and progress flow. Downloads go to `OPENBOOK_MODELS_DIR` when set, otherwise the server data directory's `models` folder (or `~/.openbook/models` without a data directory). The completed model is discovered without restarting.
4. Check that Settings reports the runtime and model ready, then transcribe a recording.

The default model is multilingual Whisper base (`ggml-base.bin`, approximately 142 MiB), with automatic language detection. It trades some accuracy on noisy speech, accents, and difficult multilingual recordings for a smaller download and lower memory use than larger models. Whisper downloads do not change the selected chat model.

Explicit cloud transcription configuration takes precedence over local inference. Otherwise the server tries local transcription, then the existing mock fallback. Local transcription works even with chat disabled; explicitly disabling transcription still disables it. Missing executables or model weights produce an actionable error pointing to Settings → AI.

## Processing and limits

FFmpeg converts recordings to mono 16 kHz PCM WAV. Whisper loads the model for each job and returns text plus segments in seconds; `durationMs` is the rounded maximum segment endpoint in milliseconds. Each job uses a private temporary directory. Cancellation and server shutdown kill active child processes, wait for them to close, and remove scratch files.

Each server permits at most **two local transcription jobs at once**, shared across all clients. There is no queue. Busy requests return HTTP **429** with `Retry-After: 5`. Permits remain held through temporary-file cleanup and are released on success, failure, or cancellation.

The transcription route also allows **six local requests per socket IP per 60-second fixed window**. Excess requests return HTTP **429** with `Retry-After: 60`. Client-supplied forwarding headers do not change this key; clients behind a reverse proxy may share its socket IP budget. The limit applies only when the resolved backend is local; cloud and mock backends are unaffected.

## Native smoke test

Install the optional executables and download `ggml-base.bin` into your model directory, then run from the repository root:

```sh
OPENBOOK_TEST_WHISPER=1 \
OPENBOOK_MODELS_DIR=/absolute/path/to/models \
OPENBOOK_WHISPER_BIN=/absolute/path/to/whisper-cli \
OPENBOOK_FFMPEG_BIN=/absolute/path/to/ffmpeg \
VITEST_MAX_WORKERS=1 \
pnpm --filter @book.dev/server exec vitest run src/transcription.test.ts \
  -t 'native whisper'
```

This opt-in test synthesizes a small WAV and exercises the HTTP transcription route without cloud keys, asserting the result shape. It is a runtime integration check, not a speech-accuracy benchmark. Without `OPENBOOK_TEST_WHISPER=1`, the native test is explicitly skipped. The regular subprocess-fixture tests cover concurrency, cancellation, failures, timestamp conversion, and cleanup without installing native dependencies.
