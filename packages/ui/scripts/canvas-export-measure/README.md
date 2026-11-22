# BUILD-6 canvas export acceptance

Audited at: `05eac93657e076c7ee745e332f8851fd16c7618b`.
Original slice baseline: `99cd2dc77d8955fbc8929e03a91800a5c3c6e4f7`.

Owner ruling 2026-11-22 authorizes exactly **10,086 B**, no inferred margin.
**Growth past 10,086 is a NEW OWNER RULING.** Superseded 9,413 is
**superseded-by-re-gate-findings**: correct for the candidate before the design
re-gate; the record is a sequence of better-informed decisions. Ruling chain:
**9,343 → +111 M1 mirror regression repair → +5 crop repair → +627 fit-and-centre
=10,086 B**. The owner chose the complete fitted variant, not the working
crop-only 9,459 variant that opens at origin.

| Quantity | Bytes | Scope |
| --- | ---: | --- |
| Historical slice | 2,981 | Raw IIFE delta at 59c49f80 |
| Historical coordinate | 3,159 | Coordinate at that historical artifact |
| Superseded authorization | 4,096 | CALIBRATED-TWO-CONTRACTS-AGO, not a miss |
| Historical projected remainder | 656 | Planning, never current headroom |
| Superseded calibration | 9,413 | superseded-by-re-gate-findings |
| Authorized coordinate | 10,086 | Owner boundary; calibration artifact 3c47b972 |
| Current measured coordinate | 10,030 | Camera-input repair, 56 B below authorization |

Final measured artifact **1,942,405 B = 1,932,375 +10,030**, SHA256
`60c516011e03c091f31156cb8105b5c83f794fe163165bb124c07f440691cab4`.
Raw slice cost **9,178 B** against baseline 1,933,227. Consumer sum:
567 +160 +38 +15 +72 +9,178 =10,030. Motion stays 211,511 rendered B;
aggregate growth 95,892 raw B leaves 166,252 B (63.4%) of the 262,144 allowance.
The historical 4,096 correctly calibrated pre-option-B; curve fidelity,
quarantine and producer projection were ruled in afterward. See the ledger for
historical contract prices, final partition and separate raw/rendered units.

UNLANDED provenance stays through merge; a tiny follow-up records main's actual
squash SHA. Commit identity is metadata, not Git-existence validation. The module
partition is regenerated at the measured artifact; shared modules count once.

Taste rulings 2026-11-22: **28px caption-link ladder and muted caption ink**.
Export-side CSS, confirmed zero viewer delta. The writer-wide compression scope
below is explicitly accepted by the owner.

Static export and viewer independently compute the identical fitted camera from
the same scene and canonical 624px inner box. No camera attribute is serialized or read.
Static image and live canvas share the 624:height aspect ratio and scale together
at narrow widths; resize does not refit. Native pointer deltas map back into
canonical coordinates. Empty input retains the app's origin/zoom-1 camera.
Exact camera drift is checked before Canvas2D's f32 matrix readback; the browser
check separately asserts exact Math.fround readback, never an epsilon.

PDF capture disables hydration before parsing by setting the frame flag, not an
inline script forbidden by export CSP (SBX-3 history). This restores static PDF
projection for **all hydrated-export block types**, not only canvas. The
non-canvas base/head control retains text and image, restores the static database
link instead of an unsupported card, changes image alignment to its static
projection, and removes the blank second page caused by capturing the hydrated
1400px iframe body. Single-page exports do not resolve a database roster; a
resolved database-site export stays on the already-static path. Canvas text
remains rasterized, without a searchable text layer. PDF-only PNGs use 3× CSS
pixel density; HTML/Markdown/clipboard keep their regular density. The fixture's
PNG grows from 16,583 to 76,217 B (+59,634 output-content B, zero viewer-code B).
Both PDF document modes enable lossless Flate compression for RGB and alpha
streams. At 3× the paged PDF is 37,371 B and continuous is 37,397 B; same-scene
compressed 1× controls are 12,989 / 13,016 B (+24,382 / +24,381 B for density).
The rejected uncompressed 3× candidate was about 8MB. Full rendered-page pixels
are unchanged by compression; the PDF meter checks both stream filters and
fires controls when either is removed. The viewer artifact remains unchanged.

The direct canvas keyboard-focus rule survives browsers without parent-selector
support. Native pointer and keyboard cases each have a firing control, and the
fallback is tested with parent-selector rules removed. H2/H3 and figure-last
fixtures extend document box/paint identity; no arbitrary nested-block claim.

## Acceptance coverage

| Contract | Verification | Boundary |
| --- | --- | --- |
| Five kinds, curves/q, ordering, fonts, clipping | `checkParity.mjs`: 180 exact RGBA comparisons, clear-surface controls, DPR 1/1.5/2, zoom .5/1/1.25/2/4, widths 300/300.5, generic sans/serif/mono | Tested Chromium/font environment; no equivalence assumed with app Inter |
| Malformed input/empty scene/projection | `canvasScene.test.ts`, fresh Yjs import and unchanged source bytes | Committed input quarantine; viewer never edits |
| No-JS and hydration | `checkHandoff.mjs`: PNG before boot, exact PNG/live pixels and figure rects, original boot, firing CLS controls | Ten runs each of preceding/following/surrounding paragraphs at 1100×900, DPR1; earlier single-canvas DPR1/1.5/2 legs |
| Mixed-document layout | Exact paragraph AND figure rect equality across handoff | Top-level paragraph compositions, not arbitrary nested blocks |
| Local interaction/remount | `checkInteraction.mjs`: native pan, keyboard zoom/reset, original fallback survives remount, destructive-copy control | Local repaint, no physical-presentation latency claim |
| PDF | `checkInterop.mjs` calls real `toPdf` paged/continuous; `checkPdf.py` independently decodes, checks exact embedded RGBA, exact drawing transform and actual rendered drawing-region fidelity, stripped-image firing control, surrounding selectable text | Canvas text is rasterized; other PDF text uses existing PDF font mapping |
| Markdown | Actual ZIP read by Marked 18, relative PNG decodes and matches source bytes, text alternative present | One real reader, not every Markdown implementation |
| Clipboard HTML | Actual ClipboardItem native-pasted into Chromium contenteditable; image decodes and matches bytes, surrounding text retained | One HTML paste consumer; no universal external-editor claim |
| Source-island reimport | Exact island data and fresh decode, unchanged encoded source bytes | Export artifacts gain PNG payload; persisted schema unchanged |

Mixed-layout diagnosis: PNG already had `display:block`, disproving the inline-image baseline hypothesis. Static paragraphs used 24px line boxes and 9.6px collapsing margins; hydrated paragraphs used the same line box with 4px padding on each side. Matching static paragraph boxes within canvas exports removes the 1.59375px figure shift without offsets. Export-only CSS leaves the viewer artifact byte-identical. CLS cannot reliably observe replacement-tree movement, so exact geometry comparisons supplement it. Controls enlarge a stable viewport to move the existing summary/following content.

Manager-side design review runs first on the initial push; polish captures, token/legibility judgments, hardware/iPad and R2 usage judgments remain review/epic work. No public harness URL is exposed.

## Reproduction

Build prerequisites in workspace order (`pnpm run build:libs`), then `pnpm test`, `pnpm lint`, and `pnpm typecheck`. The viewer ledger tests exercise the actual artifact plus +10,086/+10,087 and −506/−507 boundaries. Full production UI build includes viewer and TypeScript.

From `packages/ui`, build this harness with `pnpm exec vite build --config scripts/canvas-export-measure/vite.config.mjs`, then preview with the same config (loopback port 5186). Browser scripts launch a fresh Chromium per case with the documented sandbox-compatible single-process recipe. Set `BUILD6_HANDOFF_OUTPUT` to an evidence JSON path; `BUILD6_MIXED` accepts `rich`, `preceding`, `following`, `surrounding`, `h2`, `h3`, `last`, or `empty`; `BUILD6_RUNS` defaults to 10. `BUILD6_INTEROP_OUTPUT` names the interop JSON and adjacent PDFs/reference PNG. Run `checkPdf.py` with that path in a separate Python environment containing PyMuPDF. Source stamps, built artifact hashes and output readbacks are asserted.

`finalAccounting.mjs` takes `BUILD6_ACCOUNTING_OUTPUT`, regenerates the partition, reconciles raw consumer deltas exactly, and verifies the unchanged owner ceiling. `measureCosts.mjs` takes `BUILD6_COST_OUTPUT`, builds deliberately noncompliant independent subtraction controls and restores the byte-identical full artifact; it is evidence tooling, never a release configuration. Do not run these concurrent with production builds.

Server-suite environmental comparison: the full sandbox run had 1,452 passing server tests and one `mirror.integration.test.ts:128:55` failure accompanied by EMFILE watch exhaustion. Base 99cd2dc7 reproduces that same assertion/error class with the same dependency environment. Head and base each pass all three mirror tests unsandboxed. Server/SDK/MCP/lockfile deltas are empty. No server test was changed; the original sandbox failure is not represented as a green run.

Run all four mixed layouts permanently: `for layout in rich preceding following surrounding; do BUILD6_MIXED=$layout BUILD6_RUNS=10 BUILD6_HANDOFF_OUTPUT=/tmp/handoff-$layout.json node scripts/canvas-export-measure/checkHandoff.mjs || exit; done`.
Run `checkDocumentPaint.mjs` with `BUILD6_PAINT_OUTPUT` for ten fresh no-JS/live pairs;
its full-page outside-figure comparison is exact zero, with title-ink control.
`checkInteraction.mjs` exercises native drag (no focus ring), native keyboard
navigation (token ring), centre-anchored zoom before/after pan, and firing CSS
and origin-translation controls. Paint-context identity is export-scoped;
figure-scoped hydration is a future architecture question, not implemented here.

The paint guard also observes the caption strip INSIDE the figure (unmasked),
with its own ink control. Chromium's 1/64px intrinsic text-width difference from
one parsed text node versus three React text nodes is diagnostic geometry only:
caption pixels, figure rect and outside-figure pixels remain exact. See the
ledger's named LayoutUnit mechanism and measured controls; no epsilon is used.


Camera-input regression: `checkCameraInput.mjs` checks absent, non-JSON, null,
empty-object and zero-zoom obsolete attributes against the current production
runtime and the saved 4315517c runtime. The current drawing must be pixel-identical
to the good fallback in every case. The old runtime must fire both error-boundary
loss and hidden-fallback/blank-canvas controls. Set `BUILD6_CAMERA_CONTROL_VIEWER`
to that saved bundle, `BUILD6_CAMERA_OUTPUT` to an evidence JSON path, and
`BUILD6_ORIGIN` to the built harness. This is an obsolete metadata input, not
scene data: damaged scene quarantine remains independently tested.
