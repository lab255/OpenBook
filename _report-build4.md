# BUILD-4 — inline canvas editing surface

Audited at: 229927603c5a9c51a69a25ee7f89f0e73d9ea443

Canvas now registers through the app wrapper and supports immediate Canvas2d pen input, rectangle/ellipse/arrow/text creation, selection/manipulation, whole-object erase, numeric/style/name controls, page-history undo/redo, keyboard equivalents, Objects navigation, bounded row height, pan/zoom and pageReadOnly gating. Native text entry keeps composition; the synthetic test asserts 日本語 arrives while shortcuts are suppressed. Move/duplicate restore nested Y types through an app-installed generic constructor seam. Points APIs use explicit arity. No canvas editor enters the standalone viewer.

## Final validation

- SDK build and full `pnpm --filter @book.dev/ui build` pass (production viewer + app + TypeScript).
- 213 UI focused tests pass, including actual BlockEditor input-boundary regressions, catalogue drift, slash insertion, two-replica/reload advisories, canvas history and relay.
- 57 SDK catalogue/validation tests pass without weakening the full canvas validation checks.
- 8 ledger/fence tests pass, with deliberate forbidden-module/endpoint controls.
- Full CI command `pnpm run lint` passes across the workspace, including UI `eslint . && pnpm run lint:css && pnpm run test:stylelint`. Changed TS/TSX ESLint also passes. The final automatic fixes were indentation and `let` → `const` only.
- Production graph inspection: viewer excludes canvas editor, remote batching and measurement harness; app includes editor and remote batching, excludes harness. Configs/fs allow-lists unchanged.
- Six deterministic schema encodings byte-identical to audited base; deliberate persisted pointArity adds 18 B. This is the DOCUMENT axis, not viewer-code savings.

Evidence lives in `_evidence-build4/`; historical failed runs are retained and superseded by final results below, not counted as passes.

## Viewer coordinate sequence and mechanism

| Revision/checkpoint | nonMotionGrowthBytes | Delta | Mechanism/provenance |
|---|---:|---:|---|
| Held f70a953d8d6b201c5193839975264507d5f608b8 | 727 B | held | BUILD-3 history seam; `_report-build3.md`, `_evidence-build3/optionB/held-viewer-measurement.json` |
| BUILD-3 merge 22992760 | 765 B | +38 B | Option-B projection seam; `viewer-before.json` |
| BUILD-4 constructor checkpoint (uncommitted) | 780 B | +15 B | Generic props constructor; `viewer-seam.json`, `production-graphs-780.json` |
| BUILD-4 full-catalogue checkpoint (uncommitted, rejected) | 1,176 B | +396 B | Data +264 raw B, validation +132 raw B; `catalogue-byte-stop.json`, `catalogue-ablation.json` |
| This BUILD-4 implementation endpoint | **852 B** | **−324 B** | Minimal known-type viewer entry; full canvas metadata/validation stay SDK/server/app-side; `production-graphs.json` |

The intermediate BUILD-4 values are working-tree measurements, not fabricated commits. The PR attaches this endpoint to the actual implementation commit; subsequent commits must be measured separately. Final raw viewer = **1,933,227 B**. Compared with 765, total shared growth = **87 B**, under the 300 B seam limit. Canvas catalogue cost over 780 = **72 B**, meeting the bounded ≤100 B target. Authorized ceiling = 4,096 B; current margin **3,244 B**. The prior measured F1 slice estimate ~2,588 B projects **~3,440 B**, leaving **~656 B**. F1 is not shipped or measured anew here.

### Catalogue diagnosis before reduction

Controlled production ablations (write:false, no files modified) reproduce 780 → 1,044 with data only (+264 raw B), 780 → 912 with schema only (+132 raw B), and 780 → 1,176 with both (+396 raw B). Module graph deltas before final minification: `blockCatalogue.js` 10,388 → 10,711 (+323), `blockPropSchemas.js` 9,395 → 9,580 (+185). No transitive/new modules. These graph bytes are not the minified endpoint cost. The first diff incorrectly paired duplicate normalized Radix module IDs to the first instance; checking their byte multisets proved both copies unchanged, and the corrected diff groups duplicate IDs. The original diagnostic output is retained as `catalogue-ablation-inprocess.json`, not an accepted growth attribution.

The viewer currently imports reactiveCore, not app registration, so canvas remains the existing unsupported/placeholder path. It needs a known void type, not editing-grade field descriptions or validation. The existing `__OB_SAFE_EXPORT_VIEWER__` build flag selects a minimal canvas entry and empty canvas-specific schema in the viewer. Unset (SDK/server) and false (app) retain full definitions. Other types are unchanged. BUILD-6 must price and add whatever canvas validation its viewer fidelity actually needs.

## Keyboard parity enumeration

| Exposed pointer action | Keyboard equivalent | Test name |
|---|---|---|
| Draw stroke | P, Enter; arrows/Shift arrows; Space; Enter | `keyboard parity enumeration: stroke creation` |
| Rectangle | R, Enter; numeric bounds | `keyboard parity enumeration: rectangle creation` |
| Ellipse | O, Enter; numeric bounds | `keyboard parity enumeration: ellipse creation` |
| Arrow | A, Enter; endpoint fields | `keyboard parity enumeration: arrow creation` |
| Text creation | T, Enter; native field; Ctrl/Cmd+Enter | `keyboard parity enumeration: text creation` |
| Select one | Objects roving option + Space | `keyboard parity enumeration: single selection` |
| Select several | Objects Shift+arrows / Ctrl/Cmd+A | `keyboard parity enumeration: multi selection` |
| Move | Arrows 1 unit / Shift arrows 10 | `keyboard parity enumeration: move` |
| Resize bounds | Width/Height fields | `keyboard parity enumeration: bounds resize` |
| Arrow endpoint handles | Start X/Y and End X/Y fields | `keyboard parity enumeration: arrow endpoints` |
| Style | Same native labeled fields | `keyboard parity enumeration: style` |
| Erase sweep | Selection + Delete; E, Enter, Erase selected | `keyboard parity enumeration: erase` |
| Duplicate | Ctrl/Cmd+D | `keyboard parity enumeration: duplicate` |
| Arrange | Ctrl/Cmd+[ / ]; Shift for back/front | `keyboard parity enumeration: order`; four `parity detail: … order control and shortcut` rows |
| Pan | H, arrows 40px / Shift 160px | `keyboard parity enumeration: pan` |
| Zoom | +/−; native zoom field | `keyboard parity enumeration: zoom` |
| Height drag | Separator arrows 16px; native height field | `keyboard parity enumeration: height resize` |
| Undo | Ctrl/Cmd+Z | `keyboard parity enumeration: undo` |
| Redo | Ctrl/Cmd+Shift+Z / Ctrl+Y | `keyboard parity enumeration: redo` |
| Marquee/multi resize | Objects range selection; grouped numeric fields | `parity detail: marquee and list range both select two; grouped resize and move use numeric/arrow controls` |
| Re-edit text / text wrap width / font size / name / fill | Objects Enter; native fields | `parity detail: existing text is editable through Objects Enter; box width never changes font size` |
| Constrained geometry / aspect / fit / actual size / Reveal / Help | Aspect checkbox, numeric fields; 0 / 1; Reveal button; ? | `parity detail: aspect ratio, constrained rectangle, numeric zoom, fit, actual size, Reveal and Help` |

Additional boundary proof: `full-page integration: $key stays inside $label while the block is selected` runs Delete/Backspace across 15 native controls (height, zoom, X/Y/W/H, stroke/fill/name, arrow endpoints, text size/editor) without preventing native defaults or deleting the page block. `full-page integration: page-level %s still removes the selected block outside canvas focus` proves both page deletion keys still work. Composition suppression AND composed text arrival are asserted in `text editing uses native field; composition and input focus suppress tool shortcuts (physical IME remains manual)`.

## Synthetic immediacy and raster fidelity

Same N=12 scenes/methods before and after. Chromium synthetic mouse input; “trackpad-class” is a mouse pointer path with three move steps, not physical trackpad hardware. Input-to-rAF raster-availability estimates, not physical presentation. Raw samples: `browser-measurements-before.json`, `browser-measurements-after.json`.

| Input | Scene | Before median/worst ms | After median/worst ms |
|---|---|---:|---:|
| Desktop synthetic | Empty | 14.85 / 21.90 | 16.00 / 16.30 |
| Desktop synthetic | 500 strokes | 38.60 / 59.20 | 16.35 / 16.50 |
| Desktop synthetic | 500 + remote edits | 32.70 / 54.40 | 3.00 / 3.20 |
| Trackpad-class synthetic | Empty | 16.00 / 20.80 | 16.05 / 16.40 |
| Trackpad-class synthetic | 500 strokes | 88.65 / 197.50 | 16.35 / 16.50 |
| Trackpad-class synthetic | 500 + remote edits | 60.70 / 145.10 | 3.00 / 3.30 |

All after medians ≤50ms. The ~3ms concurrent samples reflect rAF phase; they do not establish faster physical rendering under concurrency. Every run includes a fresh-replica leg. No latency rerun after accepted correction; later changes concern input cleanup, keyboard boundary and catalogue.

Profile confirmed **24,500 Canvas2d stroke calls per dense-scene pointerdown**, 73,506 over three moves. Settled scene now caches in exact screen/device pixels; active local samples paint immediately, with no throttling/coalescing/easing. Camera/size/DPR/scene changes invalidate the settled cache. Manipulations preserve ordered reference painting.

The initial dirty-region cache failed by 45 alpha-channel units at a settled antialias edge. Controlled fresh-canvas clipping reproduced all 148 differing pixels; offscreen-to-visible composite added no error. Partial clipping was removed. Physical-pixel 1:1 copy avoids fractional resampling. **216 native raster cases pass** across DPR 1/1.5/2, zoom 100/125/200/400%, fractional dimensions/camera, overlapping/translucent five-kind scenes, pressure strokes, edits, pointerup and camera changes: settled frames exactly identical in every RGBA byte; in-gesture differences permitted only within an independently painted active-stroke mask. Negative reference-clear controls change 16,007/35,652/62,990 pixels. `raster-equivalence.json`, `raster-diagnosis.json`, `diagnosis.json`, `dense-before.cpuprofile` preserve evidence. Manager accepted the standard and latency result.

### Mechanism-matched paint-work counter (PM² addition)

The same Canvas2d counter now confirms **24,500 stroke calls per pointerdown → 0 stroke calls + 1 dot fill + 1 drawImage composite** on the initial 500×50-point scene. The before profile used the three-step pointer path; the after counting probe checks both desktop one-step and trackpad-class three-step paths, N=12 gestures each, with identical initial scene and coordinates. Every after pointerdown has the same zero-stroke/one-fill/one-composite result. A new contact is an arc-filled dot, which is why the stroke-call count is zero rather than one. This pairs with the accepted dense trackpad-class median **88.65 → 16.35 ms**; desktop dense median is **38.60 → 16.35 ms**.

| Input event, first 500-stroke gesture | Before stroke calls | After stroke calls | After composites |
|---|---:|---:|---:|
| Pointerdown, both after input conditions | 24,500 (original three-step probe) | 0, plus 1 dot fill | 1 |
| Desktop single pointermove | not separately retained | 1 | 1 |
| Trackpad-class three moves | 73,506 aggregate | 1 + 2 + 3 = 6 | 1 + 1 + 1 = 3 |
| Trackpad-class pointerup | 49,003 | 24,503 | 2 |

Committed-scene rebuilding still occurs once at pointerup; the fix removes the full-scene repaint from each contact/move sample, not all settled-scene work. Desktop pointerup costs 24,501 strokes after the one-segment gesture. The probe brackets actual delivered events; it does not use the original capture-listener microtask event rows, which ran before React's handler. No new latency measurement was made.

Raw counts: `_evidence-build4/paint-work-after.json`; original counts: `diagnosis.json` → `inputCounts`. Reproduce with the isolated harness running, then `node packages/ui/scripts/canvas-measure/countPaint.mjs`. The after probe separates the same three interpolated moves into individual delivered events to attribute each count; no timing inference is made from that instrumentation. No screenshots or public exposure.

## Polish and reconnect

| Measurement | Result | Deliberate violation control |
|---|---|---|
| Join/saving/saved/save-failed CLS | 0 each | Unsized canvas mount: 0.07765289256198346 |
| Real provider reconnect CLS, single and multi transaction | 0 each | Same unsized canvas control |
| Off-token durations | 0 | 123ms: 1 |
| Opacity-derived text colors | 0 | rgba(0,0,0,.4), element opacity 1: 1 |
| Selection alignment, 100/200/400% | 0 CSS px each | 2px planted displacement: 2px |
| Drift, 20 zoom cycles | 0 CSS px | 2px planted displacement: 2px |
| Six text roles | 8.49:1 minimum; 16.29–17.93:1 others | Nonzero contrast measurements |
| Focus/selection and field boundaries | 6.70:1 / 4.74:1 | Nonzero contrast measurements |

`browser-checks.json` preserves computed values, frames and control data. Expanded-view cycles are deferred to BUILD-5. Text-role measurement is numeric computed-style evidence, not a visual or screen-reader certification. Opacity meter resolves text color into RGBA and tests alpha separately from element opacity; its original broken control is explicitly superseded.

Reconnect uses **two real production BroadcastChannel providers**. A localhost-only fault wrapper buffers actual update packets during outage, proves zero delivered bytes, releases unchanged native packets, then checks live and fresh-replica agreement, camera, focus and selection. One geometry+color command generates **one 156 B packet**, all 12 frame samples show both together. Separate Move and Style commands generate **80 B and 91 B packets**; the intermediate frame matches the complete first transaction, then the second. Concurrent local Y movement remains visible. Sampling reads scene state at frame boundaries with canvas camera/DOM selection; it is not physical presentation certification or an SSE/server outage test.

**Atomicity boundary: one Yjs transaction.** No frame may expose part of a transaction. A multi-transaction sequence may display complete intermediate states in order. Remote updates received before rAF are applied in one outer transaction, retaining each Y.applyUpdate and its origin; local input bypasses this queue. This contract is a successor handoff, not a stronger arbitrary-backlog atomicity promise.

Reconnect CLS was attributed to selection outline/handles moving via left/top. Fixed-origin transforms eliminated the measured shifts without filtering them out. Capture loss, pointercancel, Escape, focus interruption and permission loss share contact teardown: preview discarded, announcement issued, penDown reset, resting contacts quarantined; only fresh touch-down resumes navigation. Five regressions prove inert resting touches and a fresh 40px pan. Interruptions at start/mid/end preserve shared geometry. Remote deletion restores focus to a surviving object/region.

## Advisory dispositions and deferred affordances

- A1: block move and duplicate recreate nested Y.Map/Y.Array props; then drawing works on both replicas and a fresh replica, in both client-ID orders.
- A2: one tagged PointData input for append/create, rejecting untagged variable points. A3: SceneShape exposes pointArity. No binary arity field is persisted.
- Expand button/F shortcut/third hint segment: omitted, BUILD-5. Current hint is **Pen P · Select V**.
- Grid/snap checkboxes and controls: omitted, BUILD-5.
- Presence pointers/labels/selection affordances: omitted, BUILD-5.
- Help lists shipped shortcuts only. BUILD-5 must replay this list item by item when each feature ships.
- Decimation: BUILD-5. Export/standalone canvas fidelity and any needed viewer-specific validation: BUILD-6. The viewer still shows its existing unsupported placeholder.

## Honest PARTIAL / owner acceptance

Physical IME, screen-reader experience certification, actual iPad/Pencil/palm behavior, physical trackpad and presentation latency remain unverified; hardware is BUILD-2. Synthetic IME proves guard behavior plus string arrival only. Manager owns visual captures after push; this worker produced no screenshots/video and exposed no public server.

## Reproduction

Harness directory: `packages/ui/scripts/canvas-measure/`. Separate config: `vite.measure.config.mjs`. From repo root:

```sh
pnpm --filter @book.dev/sdk build
pnpm --filter @book.dev/ui build
pnpm --filter @book.dev/ui exec vite --config scripts/canvas-measure/vite.measure.config.mjs
node packages/ui/scripts/canvas-measure/checkRaster.mjs
node packages/ui/scripts/canvas-measure/measure.mjs --checks-only
# Explicit latency rerun only when needed (overwrites after-run JSON):
node packages/ui/scripts/canvas-measure/measure.mjs --ink-only
pnpm --filter @book.dev/ui exec node scripts/canvas-measure/checkGraphs.mjs
pnpm --filter @book.dev/ui exec node scripts/canvas-measure/diagnoseCatalogue.mjs
pnpm --filter @book.dev/ui exec tsx scripts/canvasSchemaBytes.ts
```

The server binds **127.0.0.1:5184 only**. No exposure command. Harness sources are excluded from both product graphs. Numeric runners use the repository's single-process Chromium recipe; no visual captures. Full measurement modes and original raw failed runs are retained for review.

## Committed provenance

Implementation commit `b75eaeb56900b9a2e904945b46823e082524fc2d` rebuilt successfully: **852 B**, raw **1,933,227 B**, identical SHA-256 `67957e3d2be144ce7e53037e28bb32f263a74d7ac1c138a1ef17d7601bc76198`. `committed-viewer.json` and `committed-build.log` preserve this post-commit check. The follow-up commit adds this provenance and ignored-by-default validation logs only; no product or measurement source changes.

Evidence-only commit `91d22c51e24387bb5c76076777de60934a9d4bec` also rebuilt at **852 B** with the identical raw viewer hash. The subsequent paint-counter evidence change adds only a measurement script, raw counts and this report; product source is unchanged.


## CI lint correction and local DoD checklist

CI on b589c05e exposed a gap in the earlier changed-TS/TSX lint check: measurement `.mjs` drivers run browser callbacks but inherited only Node globals. Added one narrow flat-config override for `packages/ui/scripts/canvas-measure/**/*.mjs`; browser globals are not widened outside the harness. No rule is disabled. Runtime/product code is unchanged.

Required local DoD now includes **full-package lint beside full build**. Run CI's exact root `pnpm run lint` (recursive package scripts), not a changed-file list, plus `pnpm --filter @book.dev/ui build`, focused suites, ledger/fence and per-commit coordinate measurement. Both exact full-workspace lint and full production UI build pass for this correction; see `full-workspace-lint.log`, `lint-fix-build.log` and `lint-fix-viewer.json`. Viewer remains **852 B**, raw **1,933,227 B**, identical hash **67957e3d2be144ce7e53037e28bb32f263a74d7ac1c138a1ef17d7601bc76198**; correction delta **0 B**.
