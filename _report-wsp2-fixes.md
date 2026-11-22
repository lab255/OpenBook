# WSP-2 fixes — PASS

HEAD: `48ca25cef7e75cdeaee15cda1cfa0591bc42555c` — `fix(server): harden local runtime provisioning`

- F1: Runtime rejection preserves model download/receipt and reports the runtime error; command overrides skip their tool archives. Regression tests pass.
- F2: Windows extraction selects System32/tar.exe using SystemRoot (reviewed fallback retained).
- F3: After publication, best-effort cleanup prunes old generations, extraction leftovers, archive and archive receipt. Upgrade/cleanup tests pass.
- F4: lstat regular-file checks precede binary copy/chmod. Both symlink rejection paths and a ZIP parent-traversal fixture pass.
- F5: Read-only members gain owner-write permission before fsync. ZIP/tar.xz fixtures with a read-only companion pass.

Foreground validation:
- `pnpm --filter @book.dev/server exec vitest run src/ai/runtime.test.ts src/ai/serviceDownload.test.ts src/ai/pinnedDownload.test.ts src/ai/whisper.test.ts src/transcription.test.ts` — PASS: 5 files, 52 passed, 1 skipped (native Whisper requires OPENBOOK_TEST_WHISPER=1).
- `pnpm --filter @book.dev/server run typecheck` — PASS.
- `pnpm --filter @book.dev/server run lint` — PASS.
- `git diff --check` — PASS; commit hooks passed.

One commit; no push; brief/report files excluded. Commit emitted a packed-refs.lock permission warning but exited successfully; HEAD and clean tracked state verified. Windows extraction was not executed on this macOS host.
