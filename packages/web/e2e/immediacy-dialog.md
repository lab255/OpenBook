# Command-dialog production immediacy

From the repository root:

```sh
node scripts/measure-dialog-immediacy.mjs
```

This installs with scripts disabled, provisions the workspace packages, builds the
actual Next production app, serves it with `next start`, and runs each viewport
in its own single-process Chromium invocation (`--workers=1 --retries=0`). Set
`OPENBOOK_WEB_PORT` if 3100 is occupied. The existing worker data server needs
4400 free. `TMPDIR` and `PLAYWRIGHT_BROWSERS_PATH` are inherited. `--built` skips
builds only for an unchanged, already-built revision.

Artifacts live in a timestamped `_captures/ff-immediacy-dialog/` directory:
source/runtime metadata, production build ID and browser revision, raw Chrome
trace, closed/open captures, all 12 samples and median/min/max, and a filmstrip
with the first five presented frames of each opening. No sample is discarded.
The runner measures **command dialog only**, separately at 1280×800 and 390×800,
light theme, ordinary motion, warm fonts/cache and three unmeasured open/close
cycles. The existing isolated data fixture supplies one empty Untitled page on
`/`; its Untitled palette label is the pixel target. It does not measure Select
or Settings or reuse their historical numbers.

## Timestamps and frame evidence

1. A capture-phase keydown listener emits `ff-input-N` for Ctrl/Meta+K. The parser
   selects the unique native `EventTiming` keydown whose processing interval
   contains that marker. **Start = that event's `ts`**, the unrounded native input
   creation time, not the listener time, modifier press, or Playwright call.
2. Chrome's screenshot trace category is armed at browser startup. Without this,
   the pinned single-process build yielded no filmstrip. No manual frame clock,
   rAF clock, duration changes, or reduced-motion preference are used.
3. Match each screenshot's `(source_id, frame_sequence)` to `PipelineReporter`
   begin/end pairs. Ignore dropped/no-update records. **End = presentation `ts`
   of the matched presented frame**. `Screenshot.ts` is a capture callback;
   `expected_display_time` is an estimate. Neither is used as the measurement.
   `AnimationFrame::Presentation` carries the actual presented begin-frame ID;
   when it matches the screenshot, require its timestamp to equal a presented
   pipeline endpoint. Otherwise forked reporters can give two endpoints for one
   original work sequence: preserve the full interval and use its upper endpoint
   for the gate. Never pick the faster one without that direct corroboration.
4. After tracing ends, inspect the pixels in the first row's text rectangle,
   padded 6 CSS pixels for entry scale. Subtract the closed frame's horizontal
   local contrast to exclude the underlying document's placeholder. The first
   frame with at least three new dark-ink pixels at contrast ≥5/255 is the
   provisional first visible row. Save the image and preceding images. A human
   **must verify every first-visible choice**; the detector is not a substitute
   for review. Changing content/theme/geometry requires revalidating the detector.
5. Report `(presentation - keydown)/1000` in ms, median and full min/max spread.
   The automated gate fails when any sample upper endpoint exceeds 50 ms; a
   median below 50 with a straddling spread cannot clear the gate.

## Limits and independent review

This measures Chromium's headless compositor presentation feedback, not physical
monitor scanout or photon emission, and does not predict Safari, real phones,
CPU throttling or a cold start. Trace capture/readback adds overhead; do not
subtract a guessed overhead or compare these numbers directly to a dev-route
rAF proxy. The JPEG filmstrip is downscaled, so extremely faint/subpixel text
can precede the detectable-ink frame. Treat the result as a first **confirmed**
visible-frame measurement, conservatively late, not proof of an exact first
nonzero photon. Missing screenshots/presentation joins or ambiguous first-visible
choices must not be passed. Screenshots are sampled: review gaps before the first
visible frame and retain uncertainty when a potentially visible frame is absent.

The reviewer must reproduce the command on the proposed revision, identify the
first visible row independently in all 24 filmstrips, verify native keydown and
presentation joins in the raw trace (including any fork intervals), and report
per-viewport medians/spreads and tracing overhead limits. Passing the script alone
is not “all gates clear.” For a visual optimization, compare before/after captures
and verify that scale motion remains visible, including reduced-motion behavior.

Element Timing was investigated but is not used: for this compositor opacity
entry it reported a text repaint after the 240 ms animation, not initial visible
content. Plain EventTiming ends can precede visible rows, so they are not the end
metric either.

Primary implementation references (browser revision is also recorded per run):

- [Chromium screenshot metadata and expected-time caveat](https://github.com/chromium/chromium/blob/8625e066febc721e015ea99842da12901eb7ed73/content/browser/devtools/protocol/tracing_handler.cc#L1047).
- [Chromium EventTiming exact duration and timestamps](https://github.com/chromium/chromium/blob/8625e066febc721e015ea99842da12901eb7ed73/third_party/blink/renderer/core/timing/performance_event_timing.cc).
- [DevTools' documented PipelineReporter presentation join](https://github.com/ChromeDevTools/devtools-frontend/blob/b88894b14f63f84c460f66cff8918b2b4d079eae/front_end/models/trace/handlers/ScreenshotsHandler.ts).

Parser checks: `node --test packages/web/e2e/immediacy-trace.test.mjs`.
