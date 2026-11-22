# CARD-9 command palette polish audit

The app-owned policy in `CommandMenu.tsx` and `command-palette-polish.css`
reserves the existing list maximum, restores the selected row after filtering,
and keeps keyboard targets above the bottom fade. It preserves the shared
Command/Dialog/FluidHover primitives. The palette never renders in an exported
document: export acceptance is **N/A**. The clean viewer build must nevertheless
remain within its separate feature ledger gates.

## Reproduction

Provision per the epic (install with scripts disabled; SDK, viewer, server,
MCP, then the UI package). Run from the repository root, using a free web port:

```sh
mkdir -p _captures/card-9/tmp
SINGLE_PROCESS=1 TMPDIR="$PWD/_captures/card-9/tmp" OPENBOOK_WEB_PORT=3199 \
  pnpm --filter @book.dev/web exec playwright test e2e/command-polish.spec.ts \
  --grep 'at 1280$' --workers=1 --retries=0 --reporter=list
SINGLE_PROCESS=1 TMPDIR="$PWD/_captures/card-9/tmp" OPENBOOK_WEB_PORT=3199 \
  pnpm --filter @book.dev/web exec playwright test e2e/command-polish.spec.ts \
  --grep 'at 390$' --workers=1 --retries=0 --reporter=list
```

Each invocation owns one browser/context. Set `POLISH_STAGE=before` on the
unmodified baseline to record findings without enforcing the new policy.
Other stage names keep distinct artifact directories. Set `POLISH_REDUCED=1`
with a distinct stage to exercise reduced motion. The regular-motion checks
require a boundary-spanning intermediate highlight; reduced motion requires
endpoint-only positions. The existing global 0.01ms accessibility override is
recorded separately from ordinary timing counts; it is not changed here.

Artifacts are under `_captures/card-9/<stage>/<width>/`: open, narrowed query,
cleared query, and scrolled screenshots, plus raw measurements. Playwright's
video is in `packages/web/test-results`; copy it before another invocation
replaces that directory. Keep every measurement run, including failed runs.

## Pinned method and limits

One isolated workspace has 30 fixed page titles: `Polish page 00` through
`Polish page 28`, then `Zebra reference`. Both viewport widths are 800px tall,
light theme, ordinary motion unless explicitly reduced. The route is the first
seeded page. Wait for application readiness and `document.fonts.ready`, then
warm the same route with three unmeasured open/close cycles.

For each of **12 subsequent openings in the same browser session**, a
capture-phase keydown listener records the native Ctrl/Meta+K `event.timeStamp`.
Poll on rAF until a row has nonzero bounds and its ancestor chain is displayed,
visible, and has nonzero opacity; record `performance.now()` at the **next rAF**.
This allows a paint opportunity between observations. Report the conventional
median (mean of the sixth and seventh sorted samples), min and max; retain all
12 raw samples. Video recording and the Next dev runtime remain enabled in
every before/after run. The JSON records browser, Node, build mode and sandbox
launch mode.

This is a **dev-route rAF proxy**, not an observed first painted pixel or a
compositor presentation timestamp. It does not clear the ≤50ms gate. PR #439,
`feat/ff-immediacy-dialog` at `12012018`, has a different production method:
native keydown trace timestamp to a pixel-confirmed frame joined to compositor
presentation. Its reported production medians were 40.582ms at 1280 and
34.235ms at 390 (24 samples ≤50ms). That branch was unmerged when this card
started; its script and entry-opacity policy were read but not copied or
depended upon. Those historical numbers do not grade this revision. A reviewer
still owes the gate-relevant production measurement and independent frame
review. Differences from the dev proxy are expected; do not select the nicer
number or attribute timing changes to this CSS pass without evidence.

Continuity samples use real `getBoundingClientRect()` on every rAF after an
ArrowDown, checking one persistent highlight with nonzero opacity and a frame
straddling the row boundary. Row transforms and filters are recorded separately
to detect text being animated with the highlight. Clearing the query and 27
more ArrowDown presses exercise restoration and keyboard scrolling. Settled
highlight/row edge error must remain below 1px, against actual row geometry:
the token minimum is 28px, while this dialog's retained `py-3` rows are 40px.
Mask clearance must be at least 20px. These samples are not a substitute for
reviewing the video for missing paints or blur.

A `layout-shift` PerformanceObserver reports opening, query narrowing, and query clearing
separately. Standard values exclude `hadRecentInput`; the second diagnostic
sum includes those entries. Narrowing is observed through 650ms, including the
real async note result; clearing through 500ms. Each query window fits one CLS
session window. Opening values aggregate the warm-cache measurement sequence
(not a whole-page lifetime CLS). Compare each to **0.1**, but do not call the
recent-input-inclusive diagnostic standard CLS. Preserve nonzero clear-query
values even when narrowing measures zero. Neither zero proves absence of
unobserved shifts outside these windows.

The token audit walks the settled panel's computed animation/transition
durations, comparing with 0/60/80/120/160/240ms. Decorative opacity counts cover
the search glyph and close action. Disabled input/item dimming is deliberately
retained in shared primitives. Named translucent hover tokens and the existing
bottom mask are not new opacity-derived colour recipes. Group heading case,
selection weight, geometry and per-row hover utility counts are in the JSON.

## Retained decisions and split

- Reserve `min(420px, 60vh)` even for short/empty results. This costs blank space
  but keeps the input and highlight anchored across synchronous and async search.
- Retain the dialog density exception, current-page fill, named shared hover
  token, sentence-case headings, 20px bottom mask and moderate-tier glide.
  Scroll padding makes the fade safe for keyboard selection. No new per-row
  hover fill or Motion dependency is introduced.
- Retain entry scale/opacity; this pass does not depend on or change #439.
  No shared installed FF file is edited.
- **2026-11-10 Manager ruling: split FF-DIALOG-EXIT.** During entry, Escape
  removes the panel before the next sampled exit frame, both before and after
  this change. **Forgiveness: Esc reversal not proved; no sampled reversal
  observed because the shared Dialog portal unmounts the panel before an exit
  frame.** Report the independently measured CLS results separately; they do
  not establish that Escape works.
  `packages/ui/src/components/ui/dialog.tsx:52–79` puts an unanimated centering
  div between the Portal and Content. Portal presence can remove that wrapper
  before the Content's exit can keep it alive. CSS cannot animate an unmounted
  node. A separate app-owned lifecycle wrapper must hold the panel mounted
  through the appropriate quicker exit tier (0.06/0.12/0.16s), preserve focus
  restoration, and reverse cleanly on reopening. The sampler records entry
  opacity, post-Escape frames and removal; it intentionally does not assert
  that this existing defect passes.

Workers close visual cards **PARTIAL**. The reviewer must reproduce captures,
grade all six properties, validate the production timing and CLS method, review
the split residual, and provide a real review before the Manager can clear it.
