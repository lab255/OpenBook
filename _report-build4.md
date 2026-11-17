# BUILD-4 — inline canvas editing surface

Audited at: 229927603c5a9c51a69a25ee7f89f0e73d9ea443

Canvas now registers through the app wrapper and supports immediate Canvas2d pen input, rectangle/ellipse/arrow/text creation, selection/manipulation, whole-object erase, numeric/style/name controls, page-history undo/redo, keyboard equivalents, Objects navigation, bounded row height, pan/zoom and pageReadOnly gating. Native text entry keeps composition; the synthetic test asserts 日本語 arrives while shortcuts are suppressed. Move/duplicate restore nested Y types through an app-installed generic constructor seam. Points APIs use explicit arity. No canvas editor enters the standalone viewer.

## Final validation

- SDK build and full `pnpm --filter @book.dev/ui build` pass (production viewer + app + TypeScript).
- 252 UI focused tests pass, including actual BlockEditor input-boundary regressions, catalogue drift, slash insertion, two-replica/reload advisories, canvas history and relay.
- 588 full SDK tests pass, including all 57 catalogue/validation tests, without weakening the full canvas validation checks.
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
| Arrange | Ctrl/Cmd+physical [ / ]; Shift for back/front (code BracketLeft/Right, shifted key { / }) | `keyboard parity enumeration: order`; four `parity detail: … order control and shortcut` rows |
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

**Atomicity boundary: one Yjs transaction.** No frame may expose part of a transaction. A multi-transaction sequence may display complete intermediate states in order. While visible, remote updates received before rAF are applied in one outer transaction, retaining each Y.applyUpdate and its origin; hidden documents apply immediately and visibility changes flush. Local input bypasses this queue. This contract is a successor handoff, not a stronger arbitrary-backlog atomicity promise.

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


## Consolidated code-review correction round

Review base: `b589c05e`. The lint fix is `d3bb2276`; it adds browser globals only for measurement `.mjs` files. Exact full-workspace `pnpm run lint` passes (including full UI ESLint/CSS/stylelint). The first push was stopped by a missing MCP build output in the pre-push workspace typecheck; `pnpm --filter @book.dev/mcp build` supplies that dependency without product source changes or bypassing hooks.

| Review item | Correction | Regression / evidence |
|---|---|---|
| 1: quarantined shape can delete its canvas during move | Constructor restores nested types by copying raw data, without mutation validation inside an open transaction. Invalid scalar values, missing fields, invalid points/arity, malformed containers and unknown recovery fields remain intact; reader diagnoses quarantine. Projection preserves an existing invalid arity marker instead of overwriting it. | `quarantined ord survives %s, broadcast and fresh reload without a transaction throw`: exact ord `!!bad`, dropBeside left, moveBlock, indent, duplicate; original block + cloned target survive, peers/fresh match, diagnostic asserted. `clone retains %s verbatim for quarantine and fresh reload` covers missing scalar, invalid points/arity/container. |
| 2: app-global shortcuts swallowed | Suppress only page block-selection keys and actions the canvas handles. Native defaults remain intact; unrelated shortcuts bubble, including from native text editor. | `app command palette shortcut bubbles from canvas %s while Delete remains owned` (viewport/input/text); all 30 native Delete/Backspace cases and two page-level mirror cases stay green. |
| 3: hidden-tab remote delivery stalls | Hidden documents flush pending work then apply incoming updates immediately; visibilitychange flushes and disconnect removes its listener. Visible delivery keeps the next-frame batch. | `%s hidden replica applies promptly, visibility flushes queued work, reload agrees`, both bc-remote and net. |
| 4: shifted bracket event fiction | Match physical `e.code` BracketLeft/BracketRight. Tests send real shifted key `{`/`}` plus matching code and shiftKey. | Four `parity detail: … order control and shortcut` cases. Earlier `key:']', shiftKey:true` was an impossible real-keyboard event; those tests asserted fiction and are replaced. |
| 5: locked north/south resize | Derive width from changed height, center the orthogonal axis and preserve the opposite edge. | `aspect-locked %s handle changes both dimensions and keeps opposite edge fixed`, north and south. |
| 6: captured handle unmount | Capture on the stable viewport so pointerup outside still finishes even when threshold-dependent handles disappear. | `resize captures on stable viewport through handle removal below size threshold and releases outside`; subsequent drawing works. |
| 7: whole-scene arrange writes | Use placementKey with moving IDs excluded from the destination gap, assigning new ord only to selected shapes. Normal one-shape arrange is one ord-field journal action; existing tied/long-key rebalance behavior remains. | `arrange %s writes only the selected ord in one journal action`, all four directions, exact inverse applied-key list. |
| 8: non-finite numeric input throws | Finite guards on arrow endpoints, row height, zoom and text size; bounds retain their finite guard. | `non-finite 1e999 in %s is ignored without throwing or writing`, 11 numeric inputs. Tests expose the string directly to React rather than relying on number-input sanitization. |
| 9: sustained ink unmeasured | Measured >1,000 active points on top of 500 settled strokes. No incremental-paint change: both medians pass ≤50ms at this bound. | `sustained-ink.json`, `measureSustained.mjs`, per-rAF raw samples and fresh reload. |

### Sustained-input measurement (no physical latency claim)

Native Chromium Canvas2d at DPR 1, same local machine, synthetic mouse pointer input, 500 settled 50-point strokes plus a long uncommitted stroke. Warm-up delivers 1,000 moves; N=12 measured continuation samples per input condition. Trackpad-class delivers three moves per sample group and times the last event separately; it is not physical trackpad certification. Actual retained longest-stroke counts independently verify the ≥1,000-point bound. Every measured sample changes pixels on the first rAF; completed state appears only at pointerup and reload matches.

| Input condition | Active points before timed samples | Median / worst ms | Final retained points | Before/after pointerup shapes | Fresh reload |
|---|---:|---:|---:|---:|---|
| Desktop synthetic | 1,001–1,012 | **1.40 / 1.60** | 1,013 | 500 / 501 | equal |
| Trackpad-class synthetic | 1,003–1,036 | **2.20 / 2.40** | 1,037 | 500 / 501 | equal |

These are rAF-phase raster-availability estimates, not presentation latency. They establish the requested bound only; active-preview work remains proportional to active point count. Decimation remains BUILD-5. Reproduce using the separate localhost harness and `node packages/ui/scripts/canvas-measure/measureSustained.mjs`.

### Raster method and CLS attribution closure

The reference in **every one of the 216 raster cases** is `paint(reference,[...scene,...preview],...)`, the **unoptimized full-repaint path**, on the **same machine at native backing resolution**, independently at **DPR 1, 1.5 and 2 (72 cases each)**. The optimized cache paints the other surface. Assertions compare exact RGBA bytes for settled frames, and exact bytes outside the independently painted active-stroke mask during gestures. No case compares the optimized path to itself. The full 216-case suite passes again after this review round; positive cleared-reference controls remain 16,007 / 35,652 / 62,990 changed pixels.

**CLS closure is a canvas-chrome geometry correction.** Attribution of the original **0.00011001652892561983** named `.ob-canvas-outline` and four `.ob-canvas-handle` nodes (inside canvas; outline x=549→557). The header status slot was already reserved. Anchoring those nodes at a fixed origin and moving them with immediate transforms produced measured **0**; the unsized-canvas control still produced **0.07765289256198346**. No non-canvas source was excluded and no scoping subtraction or tolerance was used. This was not a status-text fix; the exact attributed elements and correction are preserved in `reconnect-attribution.json` and the subsequent reconnect artifacts.

### Burst-paint liveness and complete gesture-exit enumeration

`%s continuous remote burst paints each frame without waiting for quiet` drives the real CanvasBlock renderer with an instrumented Canvas2d context and controlled rAF, for **30 consecutive frames × 5 updates** in each transport origin. Additional arrivals must retain the first scheduled frame ID. Every frame must composite and paint the newest received X, then the next burst starts immediately; no quiet interval is supplied. Both origins pass, with peer/fresh equality. Hidden-tab tests separately prove immediate application when no rAF is available.

One contact teardown is shared by cancellation and normal pen-up; window blur now invokes it through a stable listener. The parametrized `%s tears down pen state: resting touch stays inert, fresh touch pans 40px` enumerates **11 exits**: capture loss, pointercancel, Escape, focus interruption, permission loss, tool shortcut, toolbar tool switch, window blur, component unmount/remount, remote deletion, normal pointerup. Every route clears the active preview/input state, leaves a resting touch inert, and permits a fresh 40px pan. Normal pointerup intentionally publishes its completed stroke; cancelled routes publish none. Unmount destroys the component-local contact state and the remounted instance starts clear. No route is silently omitted as “impossible.”

### App-side validation strength before vs after the lean viewer split

The canvas SDK validation case set is **unchanged** by the lean split. Full SDK suite **588/588** passes; its catalogue/prop suite remains **57/57**. The per-shape defensive UI reader remains the detailed geometry/points validator; the SDK catalogue checks the following top-level contract, without pretending it validates every nested shape field.

| Field / constraint (same before and after split) | Test name in blockCatalogue.test.ts |
|---|---|
| Canvas is known, kit/void; canonical canvas block accepted | `accepts a void canvas and validates version, viewport bounds and projected shape-map type` |
| canvasVersion 1 accepted; 2 rejected | `accepts a void canvas and validates version, viewport bounds and projected shape-map type` |
| height 240 and 960 accepted; 239, 961, Infinity and string "360" rejected | `accepts a void canvas and validates version, viewport bounds and projected shape-map type` |
| shapes object accepted; array rejected | `accepts a void canvas and validates version, viewport bounds and projected shape-map type` |
| background string accepted; number rejected | `accepts a void canvas and validates version, viewport bounds and projected shape-map type` |

`vite.viewer.config.js` is the only config that sets `__OB_SAFE_EXPORT_VIEWER__` true, selecting the lean placeholder entry. App config sets false; SDK/server leave it undefined and the typeof-guard falls back to **full** validation. No SDK assertion or constraint was weakened. BUILD-6 separately pays for validation its future viewer fidelity requires.

### Review-round final gates

**252 UI focused tests, 588 full SDK tests, 8 ledger/fence tests, 216 exact raster cases**, exact `pnpm run lint`, full UI production build, graph exclusion and six deterministic document-byte comparisons pass. Viewer remains **852 B**, raw **1,933,227 B**, hash **67957e3d2be144ce7e53037e28bb32f263a74d7ac1c138a1ef17d7601bc76198**, delta **0 B** for both lint and review corrections. Artifacts: `review-*.log`, `review-validation.json`, `sustained-ink.json`; raster/pre-review data are retained. The separate harness is stopped; no visual capture or public exposure occurred.
