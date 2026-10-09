# WSP-2 fix round — apply Quinn's PRE-ENDORSED fixes exactly

Branch `feat/wsp-2-runtime-provisioning`, worktree /Users/eliot/Workspaces/OpenBook-wt-wsp2 (HEAD 8ded61a0). Only these changes; follow the reviewed shapes exactly (packages/server/src/ai/*).

## F1 (MED) — model download must not be hostage to runtime provisioning
service.ts startDownload (~:366): provisioning becomes non-blocking —
```ts
const runtimeError = await this.localLifecycle?.provision?.(this.downloadsAbort.signal).then(() => undefined, (e: unknown) => e);
this.downloadsAbort.signal.throwIfAborted();
await downloadPinned(WHISPER_MODEL_PIN, dest, …, this.downloadsAbort.signal);
state.done = true;
if (runtimeError) state.error = runtimeError instanceof Error ? runtimeError.message : String(runtimeError);
```
ManagedRuntime.install accepts `skip: Set<RuntimeTool>`; LocalWhisper.provision passes the tools whose whisperCommand/ffmpegCommand env override is set. Add test: provision rejects → model receipt still published. Add test: override set → that tool's archive not downloaded.

## F2 (MED) — Windows tar must be System32's
runtime.ts:86:
```ts
const tar = process.platform === 'win32' ? path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe') : 'tar';
```
and use it in the execFile call.

## F3 (LOW) — prune generations + crash leftovers
After `published = true`, best-effort inside the single-flight:
```ts
for (const e of await readdir(root)) if ((e.startsWith('install-') && e !== path.basename(install)) || e.startsWith('.extract-')) await rm(path.join(root, e), {recursive: true, force: true}).catch(() => undefined);
await rm(archive, {force: true});
await rm(`${archive}.verified.json`, {force: true});
```

## F4 (LOW) — symlink defence-in-depth
lstat-isFile check on `path.join(staging, pin.binaryPath)` before copyFile (no-extractDir path) and on `path.join(install, binary)` before chmod: throw 'Runtime binary is not a regular file'.

## F5 (LOW) — read-only members survive fsync
Before `open(file, 'r+')` in syncFiles: `if (!(info.mode & 0o200)) await chmod(file, info.mode | 0o200);`

## Missing tests (add)
- Fixture archive containing a symlink AND one with a `..` entry → provisioning rejects/ignores safely (assert the lstat rejection path).
- F1 provision-failure test (above).

## Validate + commit
Foreground: `pnpm --filter @book.dev/server exec vitest run src/ai/runtime.test.ts src/ai/serviceDownload.test.ts src/ai/pinnedDownload.test.ts src/ai/whisper.test.ts src/transcription.test.ts` + server typecheck + lint. One or two conventional commits, NO push, do NOT commit brief/report files. Report `_report-wsp2-fixes.md`: pass/fail + HEAD + per-fix line + results. Terse.
