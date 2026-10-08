# Runtime binary releases

`.github/workflows/runtime-binaries.yml` builds a **draft** `runtime-binaries-v1`
release on manual dispatch (no tag needed) or a `runtime-binaries-v*` tag push.
Manual dispatch can select a new numbered release tag. Published releases are
immutable to this workflow: it refuses to replace them. All four native legs
must succeed before the single upload job can create/update a draft.

## Build contract

- whisper.cpp **v1.8.2**, commit `4979e04f5dcaccb36057e059bbaed8a2f5288315`:
  macOS arm64 / Intel, Ubuntu 22.04 x64, Windows x64. No host-native CPU tuning
  or AVX requirement; static ggml/whisper, embedded Metal source on both Macs,
  static C++/GCC runtimes on Linux, static MSVC runtime on Windows. Linux still
  requires glibc 2.35 or newer; macOS deployment target is 13.0. No cross-builds.
- FFmpeg **7.1.1**, commit `db69d06eeeab4f46da15030a80d539efb4503ca8`:
  macOS arm64 only, static FFmpeg libraries with macOS system dynamic libraries.
  Native demuxers: Matroska/WebM, Ogg, MOV/MP4, WAV. Native decoders: Opus,
  Vorbis, AAC, common integer/float PCM. Output: PCM s16le in WAV; resampling,
  channel conversion, local files and pipes. No network, video codecs or external
  codec libraries. `--disable-autodetect`, `--disable-gpl`, `--disable-nonfree`,
  `--disable-version3` enforce the LGPL-2.1-or-later configuration.
- Upstream whisper lacks `--version`; FFmpeg spells it `-version`. The two small
  checked-in patches add the requested probe without changing inference or codec
  behavior. The workflow also runs whisper `--help`, checks Unix dependencies,
  and converts a generated WAV through FFmpeg.
- `whisper-cli-1.8.2-<target>.zip` (four files) and
  `ffmpeg-7.1.1-aarch64-apple-darwin.zip` contain a root-level executable,
  licenses, `BUILD.txt` and `SIGNING.txt`. No companion whisper DLLs are needed.
  Checksums refer to these **final signed ZIP bytes**, not the inner executables.
- `runtime-binaries-sources.zip` contains complete pristine source tarballs,
  patches, this document and the exact `build.sh`. `checksums.txt` and
  `assets.json` list all six ZIPs; the latter includes sizes for manifest pins.
  Source commits and build configuration are reproducible inputs, not a claim
  of byte-identical output across evolving runner SDKs or timestamped signing.

[GitHub's runner documentation](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)
identifies `macos-15` as arm64 and `macos-15-intel` as Intel. The script asserts
the native host architecture before building.

## Signing configuration

Build jobs use the existing **publish** environment. Its deployment branch/tag
policy must allow `runtime-binaries-v*` and the branch used for dispatch (usually
`main`); the existing `v*` pattern does not match these tags. No extra approval
gate is introduced by this workflow.

- macOS secrets: `APPLE_CERTIFICATE` (base64 Developer ID Application PKCS#12),
  `APPLE_CERTIFICATE_PASSWORD`. Identity is derived from the imported certificate;
  no extra identity secret is required. A temporary keychain is removed after use.
  Missing configuration emits a loud warning and records unsigned status; bad
  credentials or signing failures fail the job. These raw binaries are codesigned
  with a secure timestamp and hardened runtime, **not notarized**. Notarization
  is a separate follow-up; no Apple account credentials are consumed here.
- Windows secrets: `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`.
  Variables: `AZURE_SIGNING_ENDPOINT`, `AZURE_SIGNING_ACCOUNT`,
  `AZURE_SIGNING_PROFILE`; optional `WINDOWS_SIGNING_REQUIRED=1` fails closed if
  credentials are absent. Same pinned CLI, hash-verified dlib and signing wrapper
  as `release.yml`. Partial configuration or any signing/verification failure is
  fatal; entirely absent configuration warns and records unsigned status.
- Linux has no platform signing integration; its `SIGNING.txt` explicitly says so.
  SHA-256 is integrity metadata, not a cryptographic publisher signature.

Before publishing, inspect `SIGNING.txt` in **each** archive, certificate identities,
checksums and native smoke logs. An unsigned draft is for inspection, not automatic
production activation. This workflow never publishes a draft automatically.

## Activate pins only after publication

WSP-1's `runtimeManifest.ts` has not landed on this worker's base. The companion
`runtime-binaries-manifest.patch` is prepared against
`feat/wsp-1-verified-downloads`; apply it after WSP-1 merges. It adds an unused
URL helper and explicit pending asset mapping/tests, **no hashes and no supported
status flips**. Do not cherry-pick a replacement of the whole WSP-1 manifest.

1. Merge this workflow, configure signing, dispatch `runtime-binaries-v1`.
2. Download all six ZIPs plus `assets.json` and `checksums.txt` from the draft.
   Independently run `shasum -a 256` and check byte sizes; inspect licenses,
   signing status and source correspondence. Test extraction and execution on
   each supported OS. Publish the reviewed draft manually.
3. Apply the prepared patch with `git apply --check` then `git apply`. For each
   `PENDING_OWN_RUNTIME_ASSETS` entry, replace only the matching tool pin with:

   ```ts
   {
     status: 'supported',
     version: pending.version,
     url: ownRuntimeAssetUrl(pending.asset),
     sha256: /* literal independently verified ZIP digest from checksums.txt */,
     size: /* literal ZIP size in bytes from assets.json */,
     archive: 'zip',
     binaryPath: pending.binaryPath,
   }
   ```

   Commit literal values, not runtime loading of release metadata. The three
   unsupported whisper entries and arm64 ffmpeg flip; Windows whisper switches
   from the upstream DLL archive to our static executable (`whisper-cli.exe`),
   removing `extractDir: 'Release'`. Update its companion-directory test to assert
   the new root path and absence of `extractDir`. Retire the pending-only tests
   that intentionally assert the current unsupported states, and remove the TODO.
4. Run focused manifest tests, server typecheck/lint and provisioning smoke tests.
   Publish the manifest change only after those artifacts are publicly fetchable.
   For later rebuilds choose a **new** numbered tag and update the helper's base;
   never replace bytes already pinned by a shipped client.

## Mirror existing FFmpeg pins

Keep the current upstream Intel macOS, Linux and Windows FFmpeg pins until their
actual, already-pinned bytes can be downloaded and independently matched against
WSP-1 SHA-256 and size. `johnvansickle.com` removes old release paths (future 404);
`evermeet.cx` redirects to a nonstandard-port host (restricted networks fail).
Cache those verified original archives in the same draft before publication,
using unambiguous version/target asset names; add their checksums/sizes to the
release inventory, then change **only the URLs** in a follow-up manifest commit.
The build workflow's six-asset inventory is intentionally for its own builds;
perform mirroring after its final run, updating the inventory for the extra assets.
If upstream no longer serves the pinned bytes, use a previously verified cache or
review a new version/hash explicitly. Never bypass verification or use `latest`.
For an already published v1 release, mirror into a fresh numbered release.

Mirrored archives retain their own license obligations (some upstream FFmpeg
builds are GPL); the LGPL-only claim applies exclusively to our arm64 build.
Preserve each mirrored provider's corresponding source and notices as well.

## Licensing and local reproduction

whisper.cpp/ggml are MIT; retain the bundled notices. Our FFmpeg is
LGPL-2.1-or-later. Distribute the full corresponding source, modifications and
build recipe beside the executable, retain notices, and permit rebuilding with
modified libraries. These are separate executables invoked by OpenBook, not
libraries linked into OpenBook. See [FFmpeg's license guidance](https://www.ffmpeg.org/legal.html)
for distribution requirements; do not label third-party code MIT merely because
OpenBook is MIT.

From the source ZIP, extract both tarballs into a temporary workspace. Initialize
Git repositories at the specified commits by cloning/checking out the official
sources (the build verifies those commits), or apply the supplied patches to the
included tarballs and run the configure/CMake commands in `build.sh` directly.
With clean `whisper/` and `ffmpeg/` source checkouts, CMake 3.31.6, a C++ compiler,
Make and Python 3, run from that workspace:

```sh
export RECIPE_DIR=/path/to/OpenBook/.github/workflows/runtime-binaries
TARGET=aarch64-apple-darwin bash "$RECIPE_DIR/build.sh"
TARGET=aarch64-apple-darwin bash /path/to/OpenBook/.github/workflows/runtime-binaries/smoke.sh
```

Start with clean sources for a repeat build; patches intentionally fail if applied twice.
