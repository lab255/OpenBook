Canvas blocks now expand into the viewport without remounting the canvas, show bounded peer pointers and selection outlines, and offer optional grid/snap. Confirmed strokes are simplified before commit while retaining geometric and pressure fidelity; irreducible strokes are preserved and reported.

Audited at: `147cdf1c94c62b95f38147e5082fffdf8713b5f9`.

Round 3 addresses the code gate and the design follow-ups. Code re-review and manager perceptual no-jump acceptance remain pending. No worker screenshots, video, or public exposure.

## Deferral replay

| BUILD-4 deferred item | Shipping feature | Proof |
|---|---|---|
| Expand button, F shortcut, Expand hint segment | Same mounted canvas in viewport-filling posture; Back/F/Escape return | `BUILD-5: Expand replay…`, F-field/Escape mirror, browser continuity rows |
| Grid/snap controls and associated help | 16-unit grid, 4-screen-pixel pointer snap, Alt bypass; keyboard/numeric exact; no freehand snap | Grid/snap replay and move/resize/freehand tests; precision unit test |
| Presence affordances | Canvas-scoped pointer, stamped identity, tool glyph, remote outlines without handles, idle-label reduction | Hidden/visible/viewer and peer tests; native presence CLS rows |

The editable empty-sheet hint is now exactly “Pen P · Select V · Expand F”. Unimplemented export/hardware/deferred UX controls remain omitted.

## Named presence producer policy (rule 11)

The ≤10Hz ceiling governs position, not state. Newer positions replace older positions within a 100ms slot; under sustained movement, the newest position lands each slot. State transitions (tool/selection/focus-leave CLEAR) are latched and emitted without loss at the canvas producer boundary. Tool/selection transitions emit immediately; pure CLEAR bypasses the position ceiling. Clear on focus-leave immediately supersedes pending positions; immediate rejoin publishes present, not a sticky clear.

This is **current-state semantics, not an event stream**. The existing network coalescer may collapse intermediate transitions. “Immediate” means the canvas producer calls Awareness immediately; the existing network sender delivers current state on its unchanged normal path. No shared sender or server change.

Hidden tab means focus leave: clear immediately on visibilitychange→hidden; on visible, reassert only if canvas actually holds focus. Timers/events, never rAF. Explicit clears are best-effort; inherit the existing 30s TTL, ~15s refresh, and reconnect-snapshot pruning. No new backstop machinery. Read-only viewers point; presence is not proof of edit permission.

`presence-bytes.json`: synthetic UTF-8 facet measurements 236 B ordinary, 8,540 B with 64 maximum-length ASCII ids, 12,048 B with 31 retained Unicode ids (summarized), 849 B with 100 requested/64 retained ids. Unbounded Unicode control 24,635 B. Complete awareness payload is reported separately; no HTTP/SSE envelope claim.

## Round 3 corrections

- **Rendered fidelity:** online radial prefilter and bounded-window RDP remain. A deterministic local curve-to-chord cap reduces tangent displacement toward the chord; before discarding original samples, final verification checks the rendered curve against the original polyline. The fast control-hull bound has an adaptive subdivision fallback that certifies both geometric directions; failing intervals retain additional original points. Pressure is rechecked after insertion. The complete fidelity ladder is documented in `decimation.ts`. The unchanged bound is **0.5 world units**, not “0.5 storage plus 0.5 rendering.” No schema changes. Retained endpoints/corners/q extrema stay exact. Determinism holds **at the retained-points layer**, with actual Yjs reload render-input identity asserted.
- **Lattice input:** strict corner comparison excludes single-sample 45° stairs. Within at most128 samples, endpoint selection prefers fidelity-valid chords aligned with repeated lattice samples; fractional partitions are unchanged. The 300-point `(i,round(0.3i))` probe retains **7**, versus float **4**. Measured on that exact seven-point fixture: all300 original samples deviate at most **0.4789131426 units** from the stored polyline (**0.0210868574 margin**); the committed curve probes reach **0.4244733868 units** from the original polyline (**0.0755266132 margin**,65 samples per cubic interval; the production continuous verifier also enforces0.5). `lattice-line-confirmation.json` pins the population and retained tuples. Replaying that same fixture on3e9ab726 yields **182→7**; the reviewer’s241 count is a separately scoped population, not used as this fixture’s denominator. The old inclusive45° test falsely retained quantization staircases as deliberate corners, unlike the renderer’s strict-< rule; the reduction removes that false classification while the fidelity measurements stay below0.5. The earlier0.854 result belonged to the four forced anchors alone: the implementation preserved fidelity by retaining130, so this was excess retention, not shipped out-of-bound output. No published prefix is changed. Window working sets are bounded; original unsent samples still live for the pointerup verification.
- **Focus and gestures:** expanded mode uses Radix FocusScope, the same containment primitive used by PresentMode's dialog, without remounting the canvas. Native Tab/Shift+Tab tests cover both edges, inline Tab leaves, and Escape restores inline viewport focus. F during an active pointer/keyboard path does not toggle or discard it; completion followed by F works.
- **Presence:** hostile count/UTF-8 read-bound regressions; unchanged producer state deduplicates without cancelling the newest queued position or suppressing clear→rejoin/tool transitions. Transport unchanged.
- **Popup placement:** layout effect has explicit posture dependencies. Shared placement remains anchored → flip → clamp → scroll when taller than viewport. Expanded footer popups end at or above the footer border box; inline placement is unchanged. The1024×240 Help test proves an initially off-screen Close control becomes hittable after scrolling.

## Fidelity and document bytes (§7)

`round3-decimation.json` records generation equations, each population separately, all80 board trials, raw/update/projection bytes, both snapshot forms, retained-history erase, and reload equality. These are synthetic geometric proxies, **not recorded handwriting or physical device samples**. “Worst” is observed, not a hard cap. There are no predicted points or time-flushed streaming claims.

The random-walk regression has199 seeded float walks; integer sine and the all-original `(0,0)→(100,100)→(200,150)` counterexample also assert rendered deviation. The old uncapped curve is a firing >0.5 control. The benchmark's independent65-probes-per-retained-interval meter observes max rendered-to-original **0.4864933**, original-to-stored-polyline **0.4982729**, and pressure **1q =1/255**. Production acceptance additionally uses continuous hull certificates, not just these probes.

Corrected-enforcement provenance: these tables were remeasured with the cap and final rendered verification enabled. Existing float families retain the same counts; the byte-table medians/worsts reproduce within the previously observed40 B summary noise (`round3-float-tables.json`). Independently disabling only lattice partitioning reproduces all46 float fixture outputs **exactly**, including q (`round3-float-partition.json`). No fidelity parameter was retuned to obtain point counts.

| Population / class | N per mode | Constant retained median / worst | Variable retained median / worst |
|---|---:|---:|---:|
| original-synthetic-float / straight | 1 | 5 / 5 | 112 / 112 |
| original-synthetic-float / arc | 1 | 21 / 21 | 136 / 136 |
| original-synthetic-float / handwriting-like | 1 | 49 / 49 | 193 / 193 |
| original-synthetic-float / loops | 1 | 129 / 129 | 255 / 255 |
| original-synthetic-float / corner-stress | 1 | 1,200 / 1,200 | 1,200 / 1,200 |
| representative-geometric-proxies-float / smooth-curve | 5 | 10 / 11 | 51 / 81 |
| representative-geometric-proxies-float / handwriting-like | 5 | 29 / 30 | 67 / 95 |
| representative-geometric-proxies-float / loop | 5 | 40 / 42 | 67 / 102 |
| paired-float-controls / float-control-line | 1 | 4 / 4 | 71 / 71 |
| paired-float-controls / float-control-circle | 1 | 41 / 41 | 88 / 88 |
| paired-float-controls / float-control-sine | 1 | 40 / 40 | 93 / 93 |
| integer-lattice / lattice-line | 1 | 7 / 7 | 164 / 164 |
| integer-lattice / lattice-circle | 1 | 116 / 116 | 148 / 148 |
| integer-lattice / lattice-sine | 1 | 75 / 75 | 118 / 118 |

The original ten-stroke stress population remains median132.5/worst1200, above the planning targets. The lattice circle/sine also retain more than their float counterparts; the table reports that scope explicitly. Geometry wins over the derived point target. The UI overrun regression commits all1200 stress points, records and announces the overrun, and reloads identically; the ordinary-stroke mirror does not increment the diagnostic.

Five boards per population/size, random production shape IDs, UTF-8 uncompressed bytes:

| Population / strokes | Before base64 median / worst | After base64 median / worst | Before full snapshot median / worst | After full snapshot median / worst |
|---|---:|---:|---:|---:|
| original-synthetic-float / 100 | 1,610,296 / 1,610,332 | 538,108 / 538,148 | 3,675,859 / 3,675,895 | 1,106,951 / 1,106,991 |
| original-synthetic-float / 500 | 8,052,284 / 8,052,284 | 2,692,700 / 2,692,740 | 18,380,001 / 18,380,001 | 5,536,817 / 5,536,857 |
| representative-geometric-proxies-float / 100 | 694,000 / 694,036 | 191,268 / 192,992 | 1,667,497 / 1,667,901 | 413,497 / 417,830 |
| representative-geometric-proxies-float / 500 | 3,473,536 / 3,473,572 | 979,504 / 981,896 | 8,343,299 / 8,343,983 | 2,103,776 / 2,109,894 |
| paired-float-controls / 100 | 673,308 / 674,148 | 192,060 / 193,128 | 1,487,715 / 1,495,189 | 396,478 / 399,774 |
| paired-float-controls / 500 | 3,361,132 / 3,366,072 | 973,980 / 974,936 | 7,428,985 / 7,442,601 | 1,997,022 / 1,999,681 |
| integer-lattice / 100 | 332,944 / 333,180 | 172,200 / 172,272 | 637,649 / 637,735 | 316,444 / 316,472 |
| integer-lattice / 500 | 1,667,900 / 1,667,936 | 867,732 / 868,360 | 3,190,455 / 3,190,777 | 1,587,448 / 1,588,735 |

After half erase, with semantic undo retained, for the simplified boards:

| Population / strokes | Base64 median / worst | Full snapshot median / worst |
|---|---:|---:|
| original-synthetic-float / 100 | 538,388 / 538,432 | 925,419 / 925,463 |
| original-synthetic-float / 500 | 2,694,156 / 2,694,196 | 4,628,984 / 4,629,024 |
| representative-geometric-proxies-float / 100 | 191,468 / 193,192 | 345,421 / 348,384 |
| representative-geometric-proxies-float / 500 | 980,768 / 983,164 | 1,755,725 / 1,759,666 |
| paired-float-controls / 100 | 192,268 / 193,336 | 333,838 / 336,275 |
| paired-float-controls / 500 | 975,256 / 976,212 | 1,683,305 / 1,685,367 |
| integer-lattice / 100 | 172,476 / 172,548 | 270,538 / 271,046 |
| integer-lattice / 500 | 869,252 / 869,884 | 1,360,309 / 1,360,840 |

## Viewer coordinate and consumer evidence

**852 B**, raw1,933,227 B, SHA256 `67957e3d2be144ce7e53037e28bb32f263a74d7ac1c138a1ef17d7601bc76198`: exact pre-leak bundle restored. Sequence: BUILD-4 852 → first push852 → round2 878 → round3 **852**.

The +26 B was a seam leak: `ViewerApp.PageView` renders `PresentBlocks`, whose locked context makes `BlockEditor.BlockBody` pass `textEditor.readOnly=true` into `ImageBlockView`. That component returns before the placeholder picker and guards the loaded picker with `!readOnly`. **Neither keyed file input mounts in the viewer.** The existing compile-time viewer flag now keeps key identity app-side; emitted viewer bytes/hash prove exact restoration (`round3-viewer-mechanism.json`). The warning regression and its planted console control still run app-side. No adjacent product-policy change. Production graph: no canvas editor/remoteFrame in viewer, no measurement module in either product build.

**Trend:** 125 B of allowance consumed across BUILD-4/5 (727→852); the temporary26 B leak is recovered. 4096−852=3244 B remains now; estimated F1 slice2588 leaves **656 B projected**, versus630 B at878. These are the coordinate, allowance, and estimate respectively—not interchangeable byte quantities.

## Browser evidence and design handoff

- `round3-layers.json`: actual production Next app, light/dark at1280×800 and1024×640. Sidebar is covered; Back/title/all8 tools hittable. Arrange and app command palette/dialog/toast/lightbox paint above the intended surfaces and remain interactive. Inline placement/focus mirrors and the too-tall scroll proof pass. Canvas-free pages before mounting and after unmounting contain no canvas interceptor; the planted overlay makes the hit-test control fail as intended.
- `browser.json`: asserted736px column, properties two rows/80px; five enter/exit cycles at each100/200/400% preserve local view, selection, scroll and focus, with drift control and reload. Expansion is input-adjacent and not claimed as CLS evidence. Isolated unscrolled remote join/move/leave/delete/quarantine CLS legs have firing controls outside recent input. The earlier dead scrolled control was **scroll anchoring**, shown by scroll124→274 offsetting a150px insertion, not merely hypothesized input exclusion.
- `round3-ink-raster.json`:12 numerical raster pairs at100%/400%; no screenshots saved. **Round3 is less smoothed at sharp turns than round2 because original-sample fidelity is now enforced.** This is the contract being honored. Manager must judge the perceptual pairs; numeric differences are not relabeled “imperceptible.” `round2-raster-equivalence.json` was rerun:216 cache/full-paint cases over DPR1/1.5/2, all with firing controls.
- Return uses Minimize. Hover-only, pointer-transparent peers have no Tab stops; hover reveal does not block the next draw. Remote outlines offset3px outside bounds; **offset plus label** is the non-color cue. Grid is paper-relative in both themes. Snap guides are32px stationary segments. X/Y fields show preview bounds and remain controlled through a complete gesture, with a planted React-warning control.

Escape's gesture→selection→posture ladder is accepted as spec-correct. F/Back preserve selection; recapture includes F→F selection survival. White paper in dark mode is a document value; the expanded white slab is an owner taste note. Pen-default bare-click draws per UX§8 step9; stray-dot feel remains a human-acceptance item.

`round3-sustained-ink.json`: native Chromium Canvas2d, DPR1,500 settled strokes plus >1000 active samples. All newest sampled positions appear at the first observed rAF; commits/reloads agree. Peer-load leg uses a timer-driven synthetic awareness peer, asserts visible presence and every emission gap ≥100ms. The local comparison has12 observations per input class; peer-load has60 and10 peer emissions. These are handler-to-raster-availability measurements, **not physical presentation latency**. A self-rescheduling timer avoids setInterval catch-up bursts after busy input handling.

| Synthetic condition | N | Median / worst ms | Peer emissions |
|---|---:|---:|---:|
| desktop mouse synthetic/local | 12 | 1.75 / 2.80 | 0 |
| trackpad-class mouse pointer synthetic/local | 12 | 1.70 / 4.10 | 0 |
| desktop mouse synthetic/peer positions at 10Hz | 60 | 1.70 / 3.00 | 10 |

## Test infrastructure and remaining limits

The shard4 diagnosis supersedes the initial canvas-layer hypothesis. Run44882256553 had **one failed layer test**, with press-state and review-suggest passing on retry. Click logs named `nextjs-portal`; the existing artifact showed the Next “Compiling…” badge over the profile control. Exact production/single-process press-state reproduction passed; canvas-absence tests passed. **CI only** disables Next's dev indicator, with the incident named in `next.config.js`; local dev is unchanged. This removes toolchain chrome from app hit-test measurements (rules5/8/16), not product UI.

The served-source stamp hashes **content**, including UI `.js/.json`, measurement source/config, and consumed SDK dist. `round3-source-stamp.json` plants a **real source edit** and proves mounting fails; restore and identical-content rewrite pass. Mtime is never hashed. Restart after edits; measurement entrypoints compare local disk, bundle and endpoint stamps.

Full local library builds, production web build, workspace typecheck/lint, SDK588, UI3170 passed/1 skipped, app9 and complete MCP suites passed. Final full pre-push result and pushed SHA are recorded at delivery; no hooks bypassed.

Hardware/Pencil, physical latency, screen-reader experience, physical IME and human handwriting cost remain honest partials. No new transport, offline-durability, authorship or edit-authority guarantee. F1 export belongs to BUILD-6. No worker screenshots/video/public exposure.

Environmental pre-clears: shared-worktree Husky `.git/config` warning with full hooks retained; ordinary workspace builds; Next dev Watchpack EMFILE in this sandbox uses production build/start (escalate production/outside-sandbox EMFILE). Single-process Chromium uses **one browser process per client/theme/context**: closing the sole page or opening a second context's page may kill it. Escalate unexplained death with a single live page. Source mismatch is a failing measurement, never a passing result.

Evidence-layer correction: `checkGraphs.mjs` now emits `viewer.json` from the production artifact and checks coordinate/raw bytes/SHA256 against freshly read artifact bytes before write and after JSON read-back. A failed emission removes its output, so stale evidence cannot survive as a success. The planted878-coordinate control fails and leaves no file; correct852 emission and same-size changed-hash controls pass/fail respectively. The regenerated `viewer.json` agrees with the852-coordinate mechanism record and README.
