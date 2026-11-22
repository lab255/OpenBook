# WSP-3 design fixes

Commit: `c7ca373f` — `fix(transcription): align setup states with design review`. No push; no brief/report files committed.

- M1: Stale model and tool stage lines show “Update available”; primary button retained.
- M2: Unsupported tools without overrides use “Download available components”; action unchanged.
- L1: Model absence reads “Not downloaded”, without redundant label or period.
- L2: Tools use installed/not installed; model uses downloaded/not downloaded across en/de/ja/zh.
- Nit: Stage lines and ready caption use description-sized `text-sm`.
- Nit: Display label is “FFmpeg”; binary identifiers and override hints unchanged.
- i18n: New partial-download label translated in all four locales; existing update translations reused.

Validation (foreground):
- `pnpm --filter @book.dev/ui exec vitest run LocalTranscription AiSettings`: 20 passed (AiSettings covers LocalTranscription).
- `pnpm --filter @book.dev/web exec playwright test e2e/ai-transcription.spec.ts`: 7 passed, final run without retries. Initial sandbox browser-launch/server failures resolved by an unsandboxed run with a fresh server; old-copy real-status assertion updated.
- UI build, typecheck, lint: passed.
- i18n check: passed; existing missing translations elsewhere reported, no extra keys or placeholder mismatches.
- Commit hooks: ESLint, UI/web typechecks, commitlint passed. Git emitted a packed-refs lock permission warning; commit succeeded.
