#!/usr/bin/env bash
# Also used verbatim for local native validation. Run from the build workspace.
set -euo pipefail
recipe_dir="${RECIPE_DIR:-$GITHUB_WORKSPACE/.github/workflows/runtime-binaries}"
: "${TARGET:?target triple required}"
mkdir -p stage/whisper dist
case "$TARGET:$(uname -sm)" in
  aarch64-apple-darwin:Darwin\ arm64|x86_64-apple-darwin:Darwin\ x86_64|x86_64-unknown-linux-gnu:Linux\ x86_64) ;;
  x86_64-pc-windows-msvc:MINGW*\ x86_64) ;;
  *) echo "Target does not match native host: $TARGET / $(uname -sm)" >&2; exit 1 ;;
esac
# Refuse moved tags / accidental source updates, including in local builds.
test "$(git -C whisper rev-parse HEAD)" = 4979e04f5dcaccb36057e059bbaed8a2f5288315
git -C whisper apply "$recipe_dir/whisper-version.patch"
args=(
  -DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED_LIBS=OFF
  -DWHISPER_BUILD_TESTS=OFF -DWHISPER_BUILD_EXAMPLES=ON
  -DWHISPER_CURL=OFF -DWHISPER_FFMPEG=OFF
  -DGGML_NATIVE=OFF -DGGML_OPENMP=OFF -DGGML_BLAS=OFF
  -DGGML_CCACHE=OFF -DGGML_BACKEND_DL=OFF
  -DGGML_AVX=OFF -DGGML_AVX2=OFF -DGGML_FMA=OFF -DGGML_F16C=OFF
  -DGGML_BMI2=OFF -DGGML_SSE42=OFF
)
case "$TARGET" in
  *apple-darwin)
    args+=(-DGGML_METAL=ON -DGGML_METAL_EMBED_LIBRARY=ON
      -DCMAKE_OSX_DEPLOYMENT_TARGET=13.0) ;;
  *linux-gnu)
    args+=(-DGGML_METAL=OFF '-DCMAKE_EXE_LINKER_FLAGS=-static-libgcc -static-libstdc++') ;;
  *windows-msvc)
    args+=(-DGGML_METAL=OFF -A x64 '-DCMAKE_MSVC_RUNTIME_LIBRARY=MultiThreaded') ;;
esac
cmake -S whisper -B whisper/build "${args[@]}"
cmake --build whisper/build --config Release --target whisper-cli --parallel 3
binary=whisper/build/bin/whisper-cli
if [[ "$TARGET" == *windows-msvc ]]; then binary=whisper/build/bin/Release/whisper-cli.exe; fi
cp "$binary" stage/whisper/
cp whisper/LICENSE stage/whisper/LICENSE-whisper.txt
printf 'whisper.cpp v1.8.2\nsource=4979e04f5dcaccb36057e059bbaed8a2f5288315\ntarget=%s\n' "$TARGET" > stage/whisper/BUILD.txt
printf '%q ' cmake "${args[@]}" >> stage/whisper/BUILD.txt
printf '\n' >> stage/whisper/BUILD.txt
cmake --version >> stage/whisper/BUILD.txt

if [ "$TARGET" = aarch64-apple-darwin ]; then
  test "$(git -C ffmpeg rev-parse HEAD)" = db69d06eeeab4f46da15030a80d539efb4503ca8
  git -C ffmpeg apply "$recipe_dir/ffmpeg-version.patch"
  mkdir -p stage/ffmpeg
  (
    cd ffmpeg
    # Native software codecs only. No automatic Homebrew or GPL dependencies.
    ./configure --cc=clang --arch=arm64 --target-os=darwin \
      --extra-cflags=-mmacosx-version-min=13.0 --extra-ldflags=-mmacosx-version-min=13.0 \
      --disable-autodetect --disable-everything --disable-programs \
      --enable-ffmpeg --disable-doc --disable-debug --disable-network \
      --disable-shared --enable-static --disable-gpl --disable-nonfree --disable-version3 \
      --disable-avdevice --disable-swscale --disable-postproc --disable-videotoolbox \
      --disable-audiotoolbox --disable-iconv --disable-xlib --disable-sdl2 \
      --enable-avcodec --enable-avformat --enable-avfilter --enable-swresample \
      --enable-protocol=file,pipe --enable-demuxer=matroska,ogg,mov,wav \
      --enable-decoder=opus,vorbis,aac,pcm_s16le,pcm_s24le,pcm_s32le,pcm_f32le,pcm_f64le,pcm_u8 \
      --enable-parser=opus,vorbis,aac --enable-encoder=pcm_s16le \
      --enable-muxer=wav --enable-filter=aresample,aformat,anull
    make -j3 ffmpeg
  )
  cp ffmpeg/ffmpeg stage/ffmpeg/
  cp ffmpeg/COPYING.LGPLv2.1 stage/ffmpeg/LICENSE-ffmpeg.txt
  cp ffmpeg/LICENSE.md stage/ffmpeg/
  # Enforce the license result rather than relying only on configure flags.
  ffmpeg/ffmpeg -L > stage/ffmpeg/license-output.txt 2>&1
  grep -q 'GNU Lesser General Public License' stage/ffmpeg/license-output.txt
  printf 'FFmpeg n7.1.1\nsource=db69d06eeeab4f46da15030a80d539efb4503ca8\ntarget=%s\n' "$TARGET" > stage/ffmpeg/BUILD.txt
  ffmpeg/ffmpeg -buildconf >> stage/ffmpeg/BUILD.txt 2>&1
  clang --version >> stage/ffmpeg/BUILD.txt

  # Corresponding source + exact patches/recipe, attached beside the binaries.
  mkdir -p stage/sources
  git -C whisper archive --format=tar --prefix=whisper/ HEAD > stage/sources/whisper-1.8.2.tar
  git -C ffmpeg archive --format=tar --prefix=ffmpeg/ HEAD > stage/sources/ffmpeg-7.1.1.tar
  cp "$recipe_dir"/*.patch "$recipe_dir"/build.sh stage/sources/
  cp "$recipe_dir"/../../../docs/runtime-binaries.md stage/sources/README.md
fi
