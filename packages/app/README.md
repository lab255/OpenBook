# OpenBook desktop app

`@book.dev/app` is the Tauri desktop shell for the OpenBook React UI.
From the workspace root, run it with `pnpm tauri dev`.
Create a desktop build with `pnpm build:desktop`.

## Meeting microphone (macOS)

`src-tauri/Info.plist` is merged into the bundle by Tauri and supplies
`NSMicrophoneUsageDescription`. The existing hardened-runtime entitlements file
now includes `com.apple.security.device.audio-input`. Recording is requested only
from the meeting block's Record action, via `getUserMedia({audio: true})`.

The locked Tauri 2.11.2 / Wry 0.55.1 already installs the Rust
[`WKUIDelegate` media-capture callback](https://github.com/tauri-apps/wry/blob/wry-v0.55.1/src/wkwebview/class/wry_web_view_ui_delegate.rs#L126-L137).
It grants the webview permission layer; macOS TCC still controls device access,
prompts for initial consent, and persists Allow/Deny. Do not replace Wry's UI
delegate or add a second permission store. This version does not expose the newer
`with_permission_handler` API. An OS denial reaches the recorder's existing
graceful microphone error and returns it to idle.

The recorder restarts every 45 seconds for independently playable files, targeting
64 kbit/s: approximately 360,000 bytes, or 480,000 base64 characters per chunk
(container overhead and actual encoder bitrate vary). Safari can fall back to
`audio/mp4`; the server accepts both MP4 and WebM. SDK uploads and playback use
base64 JSON across `tauriFetch`, below the default 10 MiB decoded asset cap and
the server's `ceil(cap * 4 / 3) + 64 KiB` request cap at this target size. The
desktop transport test checks two such chunks byte-for-byte with mocked native
IPC; it does not prove native capture or audible playback.

Manual release-app check (requires an interactive macOS microphone):

1. Run `pnpm build:desktop`, quit any other OpenBook instance, then launch
   `packages/app/src-tauri/target/release/bundle/macos/OpenBook.app/Contents/MacOS/OpenBook`.
   Use a release bundle: `tauri dev` does not launch the managed server sidecar.
2. Insert a meeting block on a page, press Record, and allow the macOS prompt.
   Record for more than 45 seconds, then Stop. Confirm two uploaded audio chunks
   and play each; reload the page and play again to verify sidecar persistence.
3. Restart the same app and record again; the OS should retain consent.
4. Disable OpenBook under System Settings → Privacy & Security → Microphone,
   relaunch, and press Record. Confirm the microphone error appears, the block
   returns to idle, and no capture/upload starts. Re-enable permission to recover.

Distribution must rebuild, sign, and notarize the app with the new entitlement
and purpose string through the existing release process. No signing identity,
hardened-runtime setting, or notarization configuration is changed here. Permission
continuity across locally signed and distributed builds needs a check using the
owner's normal signing identity; signing changes remain owner-gated.

## Sidecar supervision verification

The bundled sidecar is supervised only in a release build (`tauri dev` uses the
external development server), so verify BOOT-4 against the uninstalled release
app:

1. From the repository root, run `pnpm install --frozen-lockfile`, then
   `pnpm build:desktop`.
2. Quit any installed OpenBook instance. In a terminal, launch
   `packages/app/src-tauri/target/release/bundle/macos/OpenBook.app/Contents/MacOS/OpenBook`
   and keep its stderr visible. On Linux/Windows use the corresponding unpacked
   release executable.
3. Open a page and make an edit. In a second terminal, identify the child whose
   command starts with `openbook-server` using
   `ps -axo pid=,ppid=,command= | rg openbook-server`; confirm its PPID is the
   OpenBook host PID, then run `kill -9 <sidecar-pid>`.
4. The host log must show `state: Respawning, attempts: 1` and, after about one
   second, `state: Running, attempts: 1`. Re-run the `ps` command and confirm the
   sidecar has a new PID. Reload the page, make another edit, and confirm it saves
   without restarting the app.
5. Open **Settings → Sharing**, change the library access setting, reload, and
   confirm the change persisted. This is an owner-gated server mutation and
   verifies that the app-run `OPENBOOK_LOCAL_OWNER_SECRET` still authenticates
   after the process respawn.
6. Trigger a deliberate restart by toggling **Settings → Publish on LAN** or by
   changing the book directory. The old generation may log an
   `expected/stale termination`, but the next surfaced state must be
   `Running, attempts: 0`; it must not schedule an automatic backoff.

The webview contract can be sampled with Tauri `invoke('sidecar_state')`, and a
repair action calls `invoke('restart_sidecar')`. Both that query and every
`sidecar-state` event use this payload:

```ts
{
  state: 'dead' | 'respawning' | 'running';
  attempts: number;
  lastExitCode: number | null;
  lastStderrTail: string[];
  socketReady: boolean;
}
```

`state: 'running'` continues to mean that the process was spawned;
`socketReady` becomes true only after the current generation accepts a host
socket connection. Existing fields and meanings are unchanged. Automatic
socket/process failures share the five-attempt budget. A deliberate repair via
`restart_sidecar` invalidates the prior generation and resets `attempts` to zero,
including when the prior state was `dead`, so the manual repair is always allowed
a fresh bounded run.

Crash-loop exhaustion, the 1/2/4/8/16-second bound, healthy reset, deliberate
stop suppression, and repair reset are deterministic unit tests in
`src-tauri/src/sidecar_supervision.rs` (`cargo test sidecar_supervision`).

## Meeting microphone manual checks

1. Launch the desktop app, open a saved page, type `/meeting`, and select
   **Meeting**. Click **Record** and accept the OS microphone permission prompt.
   On macOS, check **System Settings → Privacy & Security → Microphone** if the
   prompt was previously denied; reopen OpenBook after changing permission.
2. Speak, pause, and confirm a playable audio chunk appears. Resume, speak again,
   then stop. Confirm both chunks play and the elapsed time excludes the pause.
3. With a supported transcription backend configured, confirm transcript lines
   appear as chunks complete. If no backend is available, confirm audio and notes
   remain usable and transcription offers retry. See
   **Settings → AI → Enable local transcription** provisions the supported
   runtime and verified model with staged progress. See
   [local transcription setup](../../docs/local-transcription.md) for platform
   availability, updates, and advanced overrides.
4. Generate a summary, cancel a regeneration, and confirm the previous summary
   survives. Type a manual note. Export audio and Markdown; check the ZIP's
   individual recordings and the Markdown transcript, summary, and note.
5. Revoke microphone access and reopen the app. Attempt recording: confirm a
   permission error appears, Stop stays disabled, and manual notes still work.

These checks require the actual desktop webview and OS permission system. The
web e2e's oscillator stream does not validate desktop entitlements or hardware.
