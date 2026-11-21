# BUILD-5 first-push evidence

Audited at: `147cdf1c94c62b95f38147e5082fffdf8713b5f9`.

The inline canvas now expands in place, shows bounded peer presence, offers grid/snap, and simplifies confirmed strokes before pointerup commit. This checkpoint is ready for the **design gate first**; manager captures and human visual acceptance are pending. No worker screenshots, video, or public exposure.

## Deferral replay

| BUILD-4 deferred item | Shipping feature | Proof |
|---|---|---|
| Expand button, F shortcut, Expand hint segment | Same mounted canvas in viewport-filling posture; Back/F/Escape return | `BUILD-5: Expand replay…`, F-field/Escape mirror, browser continuity rows |
| Grid/snap controls and associated help | 16-unit grid, 4-screen-pixel pointer snap, Alt bypass; keyboard/numeric exact; no freehand snap | Grid/snap replay and move/resize/freehand tests; precision unit test |
| Presence affordances | Canvas-scoped pointer, stamped identity, tool glyph, remote outlines without handles, idle-label reduction | Hidden/visible/viewer and peer tests; native presence CLS rows |

The editable empty-sheet hint is now exactly “Pen P · Select V · Expand F”. Unimplemented export/hardware/deferred UX controls remain omitted.

## Named presence producer policy (rule 11)

The ≤10Hz ceiling governs position, not state. Newer positions replace older positions within a 100ms slot; under sustained movement, the newest position lands each slot. Tool/selection transitions emit immediately at the canvas producer boundary. Clear on focus-leave immediately supersedes pending positions; immediate rejoin publishes present, not a sticky clear.

This is **current-state semantics, not an event stream**. The existing network coalescer may collapse intermediate transitions. “Immediate” means the canvas producer calls Awareness immediately; the existing network sender delivers current state on its unchanged normal path. No shared sender or server change.

Hidden tab means focus leave: clear immediately on visibilitychange→hidden; on visible, reassert only if canvas actually holds focus. Timers/events, never rAF. Explicit clears are best-effort; inherit the existing 30s TTL, ~15s refresh, and reconnect-snapshot pruning. No new backstop machinery. Read-only viewers point; presence is not proof of edit permission.

`presence-bytes.json`: synthetic UTF-8 facet measurements 236 B ordinary, 8,540 B with 64 maximum-length ASCII ids, 12,048 B with 31 retained Unicode ids (summarized), 849 B with 100 requested/64 retained ids. Unbounded Unicode control 24,635 B. Complete awareness payload is reported separately; no HTTP/SSE envelope claim.

## Numeric results and scope

- `browser.json`: single-process Chromium DPR1, 1280×900, **asserted 736px column**, simple-shape properties **two rows / 80px**. Five expand/Back cycles each at 100/200/400% preserve camera-relative selected bounds, focus, zoom, and scroll124px; planted drift control1px; fresh replica equality. This is DOM continuity, **not a CLS claim for input-adjacent expansion**.
- Fresh-browser, unscrolled remote-event CLS: join/move/leave/delete/quarantine **0**. Each control fires0.0569759–0.0578825 with `hadRecentInput:false`, event age>700ms and control age>960ms. Remote events leave the following paragraph in place; reload equality retained.
- Scrolled-control diagnosis: insertion150px changed scroll124→274 while paragraph screen top remained548px; no layout-shift entries. This demonstrates scroll anchoring in that arrangement, not recent-input exclusion. Historical failed-control artifacts remain named separately.
- `design-polish.json`: light/dark token, focus, control, clipping and text-opacity checks at736px, with planted controls. `ink-raster.json` adds stylesheet scope: literal chrome hex count0/control1, literal durations0/control1; no new animation.
- `viewer.json`, `production-graphs.json`: **852 B coordinate**, raw1,933,227 B, SHA256 `67957e3d2be144ce7e53037e28bb32f263a74d7ac1c138a1ef17d7601bc76198`. Delta from BUILD-4 **0 B**. Viewer has no canvas editor modules; app has them; measurement harness appears in neither production graph. Authorized4096 minus852=3244 B; prior F1 estimate2588 leaves projected656 B. The only shared awareness edit is an erased TypeScript facet declaration.
- Full UI build, full workspace lint, **282 focused tests / 8 files**, and **8 ledger/boundary tests** pass at this checkpoint. Untouched full pre-push hooks run at delivery.

## Decimation: fidelity before point targets

`decimation.json` contains exact generation equations, per-class distributions, all board trials, raw/update/projection bytes, retained-history erase and reload legs. Original synthetic families: straight n500; semicircle n600; sinusoidal handwriting-like n800; repeated loops n1000; alternating sharp-corner stress n1200. Variable q oscillates as round(128+80 sin(i/35)). That ten-stroke population retains median132.5 / worst1200, above planning targets; geometry is preserved.

Representative **geometric proxies, not recorded human handwriting**, use five sample densities160/200/240/280/320 on fixed smooth-curve, handwriting-like and loop domains, with a one-cycle q modulation. Per-class N5 results:

| Class | Constant retained median / worst | Variable retained median / worst |
|---|---:|---:|
| Smooth curve | 10 / 11 | 51 / 81 |
| Handwriting-like | 29 / 30 | 67 / 95 |
| Loop | 40 / 42 | 67 / 102 |

Across all40 strokes, independent original-to-retained segment verification measures max geometric deviation **0.4975654885888501 world units** and pressure error **1q =1/255**. Endpoint-only controls measure29.9985 units /80q. Original q, endpoints, deliberate corners and pressure extrema are retained. No prediction or published prefix is simplified; producer remains pointerup-only. The UI overrun test commits all1200 stress points, records the overrun, announces “Long stroke preserved · point budget exceeded”, and verifies fresh-replica equality; ordinary-stroke mirror does not increment overrun.

Five synthetic mixed boards per size, production random shape ids; UTF-8/uncompressed snapshot bytes:

| Board | Before base64 median / worst | After base64 median / worst | Before full snapshot median / worst | After full snapshot median / worst |
|---|---:|---:|---:|---:|
| 100 strokes | 1,610,332 / 1,610,332 | 538,108 / 538,148 | 3,675,895 / 3,675,895 | 1,106,951 / 1,106,991 |
| 500 strokes | 8,052,284 / 8,052,284 | 2,692,700 / 2,692,740 | 18,380,001 / 18,380,001 | 5,536,817 / 5,536,857 |

After half erase with semantic history retained, simplified100-stroke base64 median/worst538,388/538,432; full925,419/925,463. Simplified500-stroke base64 median/worst2,694,156/2,694,196; full4,628,984/4,629,024. These are medians of the measured synthetic trials, not a general population claim. Point targets are planning outcomes, not truncation caps. Document bytes intentionally change; viewer-code bytes do not.

`ink-raster.json`: 12 native Canvas2d comparisons, three240-sample proxies × constant/variable ×100/400%. Raster differences are nonzero (reported honestly), support bounds unchanged at100%, at most1px support-bound change at400%; deliberate5-world-unit translation controls read5/20px. This **does not certify no perceptible end-of-stroke jump**; that remains a named design-review item. No images saved.

## Honest partials and environmental pre-clears

Manager-owned captures/design review (first gate), visual no-jump judgment at100/400%, screen-reader experience and physical IME remain manual. iPad/Pencil/hardware belong to BUILD-2; F1 export to BUILD-6. No new offline durability, authorship or edit-authority guarantees. JS retained-history memory, physical presentation latency and human-stroke cost distributions are not measured here.

Known environmental pre-clears: shared-.git/config Husky install write is denied but existing main-checkout hooks remain active; ordinary builds supply MCP/server command outputs. Single-process Chromium uses **one page per fresh browser**; sole-page closure may terminate the process. **Escalate if a browser dies with pages still open.** Failed-fixture artifacts are retained without relabeling them as passing evidence.
