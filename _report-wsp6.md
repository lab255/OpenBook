Implemented and committed locally. Native arm64 whisper + FFmpeg builds and smoke tests pass; workflow and prepared manifest checks pass. **No push, no release created, no active pins changed.**

| Criterion | Commit / result |
| --- | --- |
| Four native whisper targets; LGPL arm64 FFmpeg; conditional signing; draft-only release, final ZIP checksums/sizes | `737bab4f` |
| Prepared URL scheme, exact five pending pins + tests; activation/mirror/licensing procedure | `8dd7b575` (patch), `737bab4f` (guide) |
| Static MSVC policy + DLL guard; codec assertions; corrected wrapped-license check; source/smoke assets | `3b3f2236` |
| YAML, extracted Bash, native builds, focused tests, typecheck/lint | Passed; evidence below |

Validation:

- YAML parse; `bash -n` on all 12 extracted Bash steps and both shell scripts; embedded Python syntax; actionlint **1.7.12** (`-shellcheck=`): green. No existing workflow changed.
- Offline release guards: fresh dispatch without tag, tag trigger, existing draft, published-release refusal, invalid input, API failure: pass. Signing guards: absent/partial/required/complete Azure configuration and missing Apple secrets: pass.
- Darwin arm64, CMake **3.31.6**, Apple Clang **21.0.0**. Built pinned whisper `4979e04f5dcaccb36057e059bbaed8a2f5288315` with static libraries and embedded Metal using the checked-in recipe.
  `/tmp/wsp6-validation/whisper/build/bin/whisper-cli --version` → **`whisper-cli 1.8.2 (OpenBook runtime build)`**, exit **0**; `--help` exit **0**. Mach-O arm64; `otool -L` contains only system libraries/frameworks.
- Also built native FFmpeg **n7.1.1**. `--version` exit **0**; required demuxers/decoders/encoder present; GPL/NONFREE/VERSION3 all **0**; system-only dependencies. WAV conversion 48 kHz → 16 kHz, mono PCM s16le, **1,600 samples**: pass. Version probes use documented tiny upstream patches.
- Native ZIPs: contents, CRC, executable permissions and extracted `--version` pass. Source ZIP contains both complete source tarballs, patches, build/smoke scripts and guide. Local binaries are unsigned; their bytes are **not** manifest pins.
- WSP-1 is absent from this base. Temporarily materialized its two manifest files, applied `docs/runtime-binaries-manifest.patch`, then ran `pnpm --filter @book.dev/server exec vitest run src/ai/runtimeManifest.test.ts`: **5/5 pass**. Server `run typecheck` and `run lint`: **green with patch applied**. Removed temporary files afterward; follow-up patch remains committed.
- Local logs: `/tmp/wsp6-validation/{build,resume-build,smoke}.log`; binaries/archives retained there. The corrected FFmpeg shim was rebuilt and license/source packaging rerun after local validation exposed the wrapped license text.

Owner setup / remaining CI work:

- Confirm/add **publish** secrets: `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`; `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`.
- Confirm/add variables: `AZURE_SIGNING_ENDPOINT`, `AZURE_SIGNING_ACCOUNT`, `AZURE_SIGNING_PROFILE`; optional `WINDOWS_SIGNING_REQUIRED=1`. Allow `runtime-binaries-v*` and the dispatch branch in the environment policy. Existing secret availability was not inspected.
- First CI run must validate Intel macOS, Linux, Windows and real signing. Default: missing signing configuration warns and yields an explicitly unsigned draft; no automatic publication. Apple identity is derived; notarization is not included. Linux has no platform signer.
- Default release is `runtime-binaries-v1`; rebuild published bytes under a new numbered tag. Publish only after review, then apply the prepared patch and insert independently verified final ZIP hashes/sizes per `docs/runtime-binaries.md`. Mirror upstream FFmpeg only after matching existing pins and preserving its own licenses/source.

Only the supplied `_brief-wsp6.md` remains untracked. No cross-compilation or external publication performed.
