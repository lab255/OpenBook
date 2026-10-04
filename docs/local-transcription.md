# Local transcription setup

The transcription API resolves a local engine by default and never silently
sends audio to a cloud provider. **This branch exposes the resolver hook but does
not yet wire a local Whisper engine into the server.** Installing Whisper alone
will not enable the meeting block's automatic transcription. The separate
transcription controls in Settings → AI are also pending integration.

You can prepare and validate Whisper independently using the upstream
[whisper.cpp quick start](https://github.com/ggml-org/whisper.cpp#quick-start).
With Git, CMake, and a C/C++ build toolchain installed:

```sh
git clone https://github.com/ggml-org/whisper.cpp.git
cd whisper.cpp
sh ./models/download-ggml-model.sh base.en
cmake -B build
cmake --build build -j --config Release
./build/bin/whisper-cli -m models/ggml-base.en.bin -f samples/jfk.wav
```

`base.en` is English-only; choose `base` for multilingual audio. Model download
requires a network connection; inference with a downloaded model can run locally.
For an exported meeting chunk, install FFmpeg and convert it to a 16-bit WAV
before invoking the CLI:

```sh
ffmpeg -i meeting.webm -ar 16000 -ac 1 -c:a pcm_s16le meeting.wav
./build/bin/whisper-cli -m models/ggml-base.en.bin -f meeting.wav
```

This standalone CLI check does not write a transcript back into OpenBook. Until
the engine integration lands, keep recorded audio in the library and retry
transcription after configuring a supported backend. See [meeting notes](meeting-notes.md)
for the recording, explicit cloud opt-in, and export behavior.
