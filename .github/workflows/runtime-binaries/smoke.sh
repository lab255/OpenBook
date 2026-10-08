#!/usr/bin/env bash
set -euo pipefail
for binary in stage/whisper/whisper-cli* stage/ffmpeg/ffmpeg; do
  [ -f "$binary" ] || continue
  "$binary" --version
  case "$TARGET" in
    *apple-darwin)
      otool -L "$binary"
      # Only OS libraries/frameworks; reject build-tree/Homebrew dependencies.
      if otool -L "$binary" | tail -n +2 | awk '{print $1}' | grep -Ev '^(/usr/lib/|/System/Library/)'; then
        echo "::error::Unexpected non-system dynamic library"; exit 1
      fi ;;
    *linux-gnu)
      ldd "$binary" | tee /tmp/runtime-ldd.txt
      if grep -E 'not found|lib(whisper|ggml|stdc\+\+|gcc_s|gomp)' /tmp/runtime-ldd.txt; then
        echo "::error::Unexpected dynamic runtime dependency"; exit 1
      fi ;;
  esac
done
# Exercise the real whisper argument parser too, beyond the version shim.
if [ -f stage/whisper/whisper-cli.exe ]; then
  stage/whisper/whisper-cli.exe --help
else
  stage/whisper/whisper-cli --help
fi
if [ -f stage/ffmpeg/ffmpeg ]; then
  python3 - <<'PY'
import wave
with wave.open('stage/probe.wav', 'wb') as f:
    f.setparams((1, 2, 48000, 4800, 'NONE', 'not compressed'))
    f.writeframes(b'\0\0' * 4800)
PY
  stage/ffmpeg/ffmpeg -nostdin -y -i stage/probe.wav -ar 16000 -ac 1 -c:a pcm_s16le stage/probe-out.wav
  python3 - <<'PY'
import wave
with wave.open('stage/probe-out.wav', 'rb') as f:
    assert (f.getnchannels(), f.getsampwidth(), f.getframerate(), f.getnframes()) == (1, 2, 16000, 1600)
PY
fi
