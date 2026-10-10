WSP-4 implemented and committed; no push. macOS sidecars append Homebrew fallbacks while preserving inherited PATH order and managed/env-override precedence. Desktop already passes the correct app-data directory; no new data-directory or binary-override wiring is necessary. **`pnpm verify` GREEN (exit 0), run foreground/in-turn.** Clippy exits 0; all 33 Rust tests pass.

| Criterion | Commit | Evidence / limit |
| --- | --- | --- |
| macOS append-only PATH; no duplicate fallback entries | `72d45a88` | `sidecar_env::macos_path`; 4 Rust tests cover Finder PATH, either/both existing fallbacks, missing/empty PATH, non-UTF-8 and empty inherited entries, idempotence. |
| Managed `<dataDir>/bin` survives restricted PATH and custom model directory | `72d45a88`, `dc528492` | Existing data-directory chain traced below. New server regression provisions fixture tools, recreates the runtime with empty PATH and relocated models, verifies availability, rejects a wrong directory and a missing explicit override. Runtime test file: 17 passed. |
| Brew-only fallback | `72d45a88` | PATH construction and existing server resolver provide fallback discovery. Real Homebrew tools are absent on this host; actual audio transcription was not exercised. |
| Windows/Linux behavior unchanged | `72d45a88` | Both helper module and command mutation are `#[cfg(target_os = "macos")]`; no non-macOS launch or TS production changes. Cross-platform native smoke was not run. |
| Desktop checks | Both commits | Cargo tests: 33 passed, including 4 new tests. Clippy exits 0; 3 existing warnings. Native ARM sidecar starts over a Unix socket with Finder-style PATH; explicit `--data-dir` wins over conflicting `OPENBOOK_DATA_DIR`. |

Data-directory trace: `main.rs` obtains Tauri `app_data_dir()` (macOS: `~/Library/Application Support/dev.book.open`) and passes it to `spawn_sidecar` as `--data-dir`. `cli.ts:91,186` prefers that argument over `OPENBOOK_DATA_DIR`, resolves it, and passes it to `startServer`. `server.ts:441` explicitly constructs `ManagedRuntime(<dataDir>/bin)`, independently of `OPENBOOK_MODELS_DIR`. The same `LocalWhisper` runtime provisions and resolves tools; `whisper.ts:106` resolves explicit override → managed receipt → PATH. Standalone embedded mode uses its supplied CLI/env data directory; server mode without one falls back to `~/.openbook/bin`. A separately configured standalone directory is intentionally a different installation, not a desktop wiring defect.

Acceptance limit: this base checkout marks whisper-cli unsupported on both macOS architectures and ffmpeg unsupported on ARM macOS. The compiled sidecar's `/api/ai/status` confirmed those exact statuses. The managed regression uses supported fixture pins; it proves resolution, not real speech recognition. Finder-launched managed transcription cannot be certified against the present production manifest. No pins, downloads, permissions, or provisioning policy were changed.

Validation commands:

- `pnpm verify` — **PASS, exit 0**; foreground/in-turn, outside the sandbox after diagnosing its macOS watcher restriction; no negated recursive filters.
- `TAURI_CONFIG='{"bundle":{"resources":[]}}' cargo test --locked --manifest-path packages/app/src-tauri/Cargo.toml` — 33 passed.
- Same `TAURI_CONFIG`, `cargo clippy --locked --all-targets --manifest-path packages/app/src-tauri/Cargo.toml` — exit 0; existing `too_many_arguments` warnings in `ipc.rs` and `question_mark` in `main.rs`.
- `cargo fmt` was run; unrelated formatting changes were reverted. `cargo fmt --check` fails on existing formatting in `main.rs`/`ipc.rs`; reproduced against base `5b6d5d5b`. `rustfmt --check packages/app/src-tauri/src/sidecar_env.rs` and `git diff --check` pass.
- Native sidecar built with `pnpm --filter @book.dev/server run build:sidecar`; no binary committed. Cargo's resource override excludes only the unstaged LAN web export for local Rust checks; shipped configuration is unchanged.

Full verify totals: SDK 580, UI 2,501, app 9, server 1,441 tests passed (4,531 total; server 8 skipped / 1 file skipped); MCP unit/contract checks passed; server end-to-end 256 checks and MCP end-to-end 70 checks passed. The serial server stage took 1,064 seconds. No checks were disabled for this task.

Review gate: **code** — inspect the macOS cfg boundary, append/dedup semantics, and data-directory trace. Real Finder managed/Brew audio smoke remains release acceptance work once supported macOS pins and native tools are available. No UI review gate.

Local ignored evidence: `_verify.log`, `_cargo-test.log`, `_clippy.log`, `_fmt.log`, `_native-smoke.log`. Initial provisioning had failed; workspace builds repaired the missing artifacts. A disk-full interruption was followed by a fresh verification run after space was freed.

Verification environment: the sandboxed run failed the existing mirror integration test with macOS `EMFILE` watcher errors (external edits were not re-imported). Its isolated sandboxed retry reproduced the errors; the identical test passed all 3 cases outside the sandbox. The failed sandboxed run was stopped and full `pnpm verify` restarted outside the sandbox, without changing application code or tests. See `_verify-sandboxed.log`, `_mirror-retry.log`, and `_mirror-unsandboxed.log`.

All task changes are committed; no push. Unrelated untracked input/Finder metadata (`_brief.md`, `.DS_Store`, `packages/.DS_Store`) is left untouched.
