# CARD-10: slash/insert palette polish evidence

Scope: `SlashMenu` (`packages/ui/src/blockeditor/SlashMenu.tsx`) inserts registered
Form blocks alongside other block types. The `FormBuilder` field palette was
inspected and excluded because it already hosts `FluidHover`.

Run from the root after provisioning the SDK, viewer, server and MCP, then building
the UI with `pnpm --filter @book.dev/ui exec vite build` and
`pnpm --filter @book.dev/ui exec tsc`:

```sh
mkdir -p /tmp/openbook-card10
SINGLE_PROCESS=1 TMPDIR=/tmp/openbook-card10 SLASH_POLISH_PHASE=after pnpm --filter @book.dev/web exec playwright test -c playwright.slash-polish.config.ts --workers=1 --retries=0 --grep 'at 1280$'
SINGLE_PROCESS=1 TMPDIR=/tmp/openbook-card10 SLASH_POLISH_PHASE=after pnpm --filter @book.dev/web exec playwright test -c playwright.slash-polish.config.ts --workers=1 --retries=0 --grep 'at 390$'
```

The config serves **Next dev** on port 3210 (`OPENBOOK_WEB_PORT` overrides it).
It uses the committed single-process launcher and one test/browser session per
invocation. The local-storage-only `/editor-lab` route needs no shared data server.
Do not reuse a server from another checkout. `SLASH_POLISH_PHASE=before` stores
baseline evidence and skips after-only geometry assertions; it does not change
production behavior. Build the actual baseline revision before using it.

Each viewport uses light theme, ordinary motion, the same one-paragraph document,
warm fonts, and three unmeasured open/close cycles. All twelve subsequent native
`/` keydowns are measured. Start is DOM `KeyboardEvent.timeStamp`. End is the
`performance.now()` at the rAF **after** observing a visible, nonzero-opacity row.
Thus one paint opportunity follows the observed row. This is a conservative
**paint-opportunity proxy**, not a Chrome compositor/presentation timestamp or a
physical-display measurement. No measured sample is discarded. Raw samples,
median, min/max and browser version are written to `measurements.json`.

The unmerged production command-dialog reference at `12012018` (PR #439) reports
40.582 ms at 1280 / 34.235 ms at 390 using native trace/presentation joins on
`next start`. Those numbers describe a different surface and method. They are
context only and must not be substituted for this card's measurements. None of
that branch's harness code is copied here.

Continuity uses real row/glide rectangles sampled each rAF through an ArrowDown
forwarded to the editor's actual key handler. The assertions require one visible
persistent glide, intermediate travel, and <0.5px endpoint error. Twenty-four
native arrow presses then exercise scrolling. First/last wrap traces require the
selected row and highlight to stay aligned and visible on every sampled frame.
On a keyboard viewport jump the glide is re-seeded before paint rather than
travelling through offscreen content; ordinary row transitions retain the same
object. Reduced motion lands directly. Escape during travel immediately cancels
the popup and reopening is checked. Video is recorded at real speed.

Rows have a **minimum** 28px height. A long-label fixture retains the real icon,
font and row; only its text is replaced. Its wrapped height is reported instead
of assuming every possible custom label can fit on one line. The insert menu's
entry scale is disabled so first feedback and text rasterization are immediate;
the one background glide provides the visible motion. Other slash-style pickers
are unchanged.

A LayoutShift observer records entries including `hadRecentInput`; report both
standard CLS (maximum session window, excluding recent input) and raw shift sums.
Open windows and the query-change window are recorded separately. A CLS of zero
must not be described as no layout movement when the raw input-excluded sum is
nonzero. The usual CLS threshold is 0.1; it is not a raw-shift-sum threshold.

`_captures/card-10/{before,after}/{1280,390}/` contains open, selected,
keyboard-scroll, form-query and long-label PNGs, interaction video, and JSON.
Capture/measurement review is required: automation is not visual acceptance.
The form insert chrome is edit-only, but its code/shared CSS are still emitted
in the standalone viewer. A clean viewer build and endpoint check are required;
app-only runtime behavior does **not** establish byte-identical export output.
