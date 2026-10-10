# WSP-5 — one-click transcription docs and smoke coverage

**PASS — `pnpm verify` exited 0, foreground/in-turn.** Implemented the docs rewrite, provisioned-runtime HTTP/native smoke extension, and straggler sweep. Runtime implementation and manifest pins are unchanged; no helper export, binary artifact, or push. Native inference itself skipped on this host; the receipt-backed HTTP subprocess fixture passed.

## Criterion → commit / evidence

| Criterion | Commit | Evidence |
| --- | --- | --- |
| Enable is the primary setup path; stages, verified artifacts, receipts, automatic pin-change re-provisioning and Update explained | `f2dc26fd` | `docs/local-transcription.md`; manual binary installation and explicit executable exports are confined to Advanced overrides. Existing Homebrew/user PATH fallback and env → managed → PATH precedence documented. |
| Meeting, architecture and desktop guidance agree | `f2dc26fd` | `docs/meeting-notes.md`, `ARCHITECTURE.md`, `packages/app/README.md`; remote-library processing clarified. |
| Do not claim WSP-7 activation | `f2dc26fd` | Current macOS/Linux Whisper and Apple Silicon FFmpeg limitations stated; stale WSP-1-not-merged wording corrected in `docs/runtime-binaries.md`. |
| Populated `<dataDir>/bin` with receipts drives HTTP transcription | `92ee9665` | Always-on `transcription.test.ts` fixture provisions SHA-256-verified archives through real `ManagedRuntime`, reopens receipts, uses relocated models, clears PATH and both binary overrides, asserts provisioned status and exact HTTP text/segments/duration, then invalidates a receipt and expects not-ready/HTTP 400. |
| Real native smoke covers managed-only and ordinary resolution | `92ee9665` | `transcriptionNative.test.ts` has two opt-in cases using real pins/receipts and synthesized WAV over HTTP. Managed-only case clears PATH/overrides and asserts paths under the supplied data directory. Existing native case moved out of the suite that mocks the model pin to eleven bytes. Supplied installation is read-only; DB/audio fixtures are temporary and disposed. |
| Machines without runtime stay green | `92ee9665` | Default opt-in skips; explicit opt-in with absent data directory and with this host's default directory both exit 0 with two reasoned skips. Inference errors after readiness remain failures. |
| Full verification in-turn | See verification below | Foreground `VITEST_MAX_WORKERS=2 pnpm verify`, awaited through completion; no background/disowned job. |

## Verification

- Required provisioning command completed: `CI=true pnpm install && pnpm --filter @book.dev/sdk build && pnpm --filter @book.dev/ui run build:viewer && pnpm --filter @book.dev/server build && pnpm --filter @book.dev/mcp build`.
- Focused suite: `pnpm --filter @book.dev/server exec vitest run src/transcription.test.ts src/transcriptionNative.test.ts src/ai/runtime.test.ts` — **33 passed, 2 skipped**.
- Server typecheck and staged-file ESLint passed before the test commit. An initial native parameterized callback used unsupported test-context placement; corrected to individual contextual tests, then checked the actual opt-in skip path. No unresolved type/lint failures.
- `OPENBOOK_TEST_WHISPER=1 OPENBOOK_TEST_DATA_DIR=/tmp/openbook-wsp5-no-runtime pnpm --filter @book.dev/server exec vitest run src/transcriptionNative.test.ts` — exit 0, **2 skipped**.
- `OPENBOOK_TEST_WHISPER=1 pnpm --filter @book.dev/server exec vitest run src/transcriptionNative.test.ts --reporter=verbose` — exit 0, **2 skipped**, explicit unavailable-runtime/model reasons for `/Users/eliot/.openbook`.
- Native inference is **not claimed as executed** on this `darwin arm64` host. Current shipped pins do not support its two managed tools; actual provisioned native inference remains runnable where both pins and the verified model are present. Positive managed HTTP coverage here uses executable subprocess fixtures, not speech recognition.
- Full `VITEST_MAX_WORKERS=2 pnpm verify`: **PASS, exit 0**, foreground/in-turn. SDK **580**, UI **2,580**, desktop **9**, server **1,443** tests passed (**4,612 total**); server **9 skipped**, **106 passed / 2 skipped files**. The extra skip versus the previous eight is the added native managed-runtime case. Server stage: **453.71s**. MCP unit/contract checks passed; server e2e **256/256** and MCP e2e **70/70**. Builds, generated-file checks, typechecks, lint, ESLint-rule and stylelint checks all passed. The initial sandboxed run was stopped after the isolated unchanged mirror integration test reproduced macOS `EMFILE` watcher errors (1 failed, 2 passed). The same test passed outside the sandbox (3/3, 4.11s); full verification was restarted there without modifying application code or weakening tests. Logs: `/tmp/openbook-wsp5-verify.log` (stopped sandbox attempt), `/tmp/openbook-wsp5-verify-unsandboxed.log` (final run).
- Ad hoc package commands use explicit `--filter @book.dev/...` allowlists. The requested root verify command uses the repository's existing recursive scripts; no negated recursive filter was used.
- Provisioning's Husky setup warned that shared `.git/config` was outside sandbox write roots. Commits succeeded despite a shared `packed-refs.lock` warning; hooks (lint-staged/typecheck/commitlint) ran. Neither warning required changing repository configuration or bypassing hooks.

## Straggler sweep

Command: `rg -n -i 'brew install|whisper.cpp|whisper-cli' docs/ packages/*/README.md` (same case-insensitive patterns/scope requested). All **14 remaining matching lines** accounted for:

| File:line(s) | Hit / disposition |
| --- | --- |
| `docs/local-transcription.md:3` | Runtime implementation names; descriptive, no installation instruction. |
| `docs/local-transcription.md:25` | Custom/package-manager/build guidance and existing Homebrew/PATH compatibility; retained exclusively in Advanced overrides. |
| `docs/local-transcription.md:30` | Explicit `OPENBOOK_WHISPER_BIN` export; retained exclusively in Advanced overrides. |
| `docs/runtime-binaries.md:11` | Maintainer build contract naming pinned upstream source; retain. |
| `docs/runtime-binaries.md:30` | Release archive naming contract; retain. |
| `docs/runtime-binaries.md:111` | Future reviewed manifest activation changes Windows archive layout; retain as pending WSP-7, not end-user installation. |
| `docs/runtime-binaries.md:141` | Source/license attribution; retain. Local reproduction section builds release artifacts for maintainers, not installation into OpenBook. |
| `docs/runtime-binaries-manifest.patch:6` | Type context in an unapplied maintainer patch; retain. |
| `docs/runtime-binaries-manifest.patch:20,21,22,23` | Four pending asset mappings, one per target; retain as unapplied follow-up material. |
| `docs/runtime-binaries-manifest.patch:57` | Pending asset layout test; retain. |
| `docs/runtime-binaries-manifest.patch:67` | Existing upstream URL assertion; retain, does not activate own pins. |
| `packages/*/README.md` | No pattern hits remain. Desktop's generic runtime-installation wording was also replaced. |

Broader installation/download sweep additionally checked `ARCHITECTURE.md` and root `README.md`. Removed the old setup/manual PATH steps, “Download Whisper base” primary action, manual native-test prerequisite instructions, and generic required Whisper/FFmpeg installation references. No `brew install` command remains in the requested scope.

## Proposed gates / handoff

**Code-light:** normal review plus existing `pnpm verify`; no new approval, release, runtime-download, or native-hardware gate for this docs/tests change. WSP-7 signing/publication/pin activation stays separate. Native opt-in checks are available for environments carrying a supported complete installation; they are not ordinary CI requirements. No push performed. `_brief.md` is the supplied untracked task input and is intentionally excluded from commits.
