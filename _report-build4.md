# BUILD-4 — inline canvas editing surface

Audited at: 229927603c5a9c51a69a25ee7f89f0e73d9ea443

Canvas now registers through the app wrapper and supports immediate Canvas2d pen input, rectangle/ellipse/arrow/text creation, selection/manipulation, whole-object erase, numeric/style/name controls, page-history undo/redo, keyboard equivalents, Objects navigation, bounded row height, pan/zoom and pageReadOnly gating. Native text entry keeps composition; the synthetic test asserts 日本語 arrives while shortcuts are suppressed. Move/duplicate restore nested Y types through an app-installed generic constructor seam. Points APIs use explicit arity. No canvas editor enters the standalone viewer.

## Final validation

- SDK build and full `pnpm --filter @book.dev/ui build` pass (production viewer + app + TypeScript).
- 272 UI focused tests pass, including actual BlockEditor input-boundary regressions, catalogue drift, slash insertion, two-replica/reload advisories, canvas history and relay.
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
| Implementation b75eaeb56900b9a2e904945b46823e082524fc2d | **852 B** | **−324 B vs rejected checkpoint** | Minimal known-type viewer entry; full canvas metadata/validation stay SDK/server/app-side; `production-graphs.json` |
| Evidence-only 91d22c51e24387bb5c76076777de60934a9d4bec | **852 B** | **0 B** | Full production rebuild, identical raw viewer hash |
| Paint-counter evidence b589c05ed3567ffdd90819bacc5a6a7a8d5223d5 | **852 B** | **0 B** | Full production rebuild, identical raw viewer hash; product source unchanged |
| Harness-only lint fix d3bb22767a794c92662ec9e3b901fc3900ced9f3 | **852 B** | **0 B** | Scoped ESLint browser globals; full-package lint + full production rebuild |
| Consolidated review fix ecb39d1acdbe9a5c9fcc0b2c43625f57c6d771aa | **852 B** | **0 B** | Quarantine-safe clone, input/transport corrections; full committed production rebuild, identical viewer hash |
| Design corrections (this commit; hash attached after committed rebuild) | **852 B** | **0 B** | Theme tokens, icons, contextual controls and paint-only swatch selection; unchanged viewer hash |

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
| Join/saving/saved/save-failed CLS | 0 each | Unsized canvas mount: 0.06307107438016528 (design refresh) |
| Real provider reconnect CLS, single and multi transaction | 0 each | Same unsized canvas control |
| Off-token durations | 0 | 123ms: 1 |
| Opacity-derived text colors | 0 | rgba(0,0,0,.4), element opacity 1: 1 |
| Selection alignment, 100/200/400% | 0 CSS px each | 2px planted displacement: 2px |
| Drift, 20 zoom cycles | 0 CSS px | 2px planted displacement: 2px |
| Six light-theme roles | 4.58:1 pressed control; 11.85:1 body; 12.91:1 others | Computed RGB (design refresh) |
| Pressed fill vs chrome / field boundaries | light 4.58:1 / 5.01:1; dark 6.14:1 / 5.51:1 | Computed RGB, explicitly separate from focus ring |
| Chrome hex literals | 0 | Planted hex color: 1 |

`design-browser-checks.json` and `design-polish.json` preserve current computed values, frames and controls; `browser-checks.json` retains the pre-design run. Expanded-view cycles are deferred to BUILD-5. Text-role measurement is numeric computed-style evidence, not a visual or screen-reader certification. Opacity meter resolves text color into RGBA and tests alpha separately from element opacity; its original broken control is explicitly superseded.

Reconnect uses **two real production BroadcastChannel providers**. A localhost-only fault wrapper buffers actual update packets during outage, proves zero delivered bytes, releases unchanged native packets, then checks live and fresh-replica agreement, camera, focus and selection. One geometry+color command generates **one 156 B packet**, all 12 frame samples show both together. Separate Move and Style commands generate **80 B and 91 B packets**; the intermediate frame matches the complete first transaction, then the second. Concurrent local Y movement remains visible. Sampling reads scene state at frame boundaries with canvas camera/DOM selection; it is not physical presentation certification or an SSE/server outage test.

**Atomicity boundary: one Yjs transaction.** No frame may expose part of a transaction. A multi-transaction sequence may display complete intermediate states in order. While visible, remote updates received before rAF are applied in one outer transaction, retaining each Y.applyUpdate and its origin; hidden documents apply immediately and visibility changes flush. Local input bypasses this queue. This contract is a successor handoff, not a stronger arbitrary-backlog atomicity promise.

Reconnect CLS was attributed to selection outline/handles moving via left/top. Fixed-origin transforms eliminated the measured shifts without filtering them out. Capture loss, pointercancel, Escape, focus interruption and permission loss share contact teardown: preview discarded, announcement issued, penDown reset, resting contacts quarantined; only fresh touch-down resumes navigation. The complete 11-route regression enumeration below proves inert resting touches and a fresh 40px pan. Interruptions at start/mid/end preserve shared geometry. Remote deletion restores focus to a surviving object/region.

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

Chromium canvas2d, DPR 1, two input classes; this card ships one renderer — WebKit/hardware legs are BUILD-2's.

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


## Design-review correction round (reviewed base b589c05e)

The push was interrupted in its pre-push hook when the design review arrived, so lint, code-review and design corrections ship together. No hooks were bypassed. Missing generated MCP/server dist dependencies were built locally before the hook; no dependency source changed.

| Finding | Final behavior | Regression / measurement |
|---|---|---|
| F1 palette affordances | Lucide tool icons, accessible names and shortcut title hints | `design: tools use named icons and hints; Undo and Redo stay in the header` |
| D1 pressed state | Primary-token filled state and a 2px underline; distinct from focus ring | `design-polish.json`: boundary 4.58:1 light / 6.14:1 dark; icon 4.58:1 / 6.33:1 |
| D2 theme / color tokens | Canvas chrome uses existing app theme variables; no hex literals in canvas.css | Light/dark computed styles; hex 0/control 1; opacity-derived text color 0/control 1 each theme |
| D3 properties / arrangement | Only active tool or selection properties appear; strips/grip absent outside canvas focus. Controls wrap with even 8px padding. Arrange opens a keyboard-operable menu | `design: inactive controls hide; active properties follow the tool and selection`; `design: Arrange menu opens, roves, commits and closes; Help and Objects anchor at triggers`; default 800px: no horizontal overflow or clipped controls |
| F2 color swatches | Named Ink/Red/Blue, plus None for fill, alongside editable values | `design: named color swatches and editable value both change the selection` |
| F3 slash icon | App registration supplies Lucide PenTool | SlashMenu `renders an icon for each command (#3)` now asserts the canvas icon |
| F4 Undo / Redo | Icon controls with actual action names are in the header, above the viewport | Header regression above |
| I1 pen completion | Pen remains active; finishing a stroke does not select the new stroke | `design: %s finished pen leaves no selection and keeps Pen` for pointer and keyboard |
| I2 undo vocabulary | Creation journal labels are Stroke / Rectangle / Ellipse / Arrow / Text | Header regression asserts Undo rectangle / Redo rectangle; pen regressions assert Undo stroke |
| I3 keyboard placement | Whole shape centered in world coordinates at the viewport center, including after pan/zoom | `design: keyboard %s centers the whole shape in world coordinates`, R/O/A/T; parity inventory uses equivalent pointer placement |
| I4 coordinates | Display rounded to two decimals outside focus; exact persisted numeric value on focus | `design: coordinate display rounds only while unfocused, without rewriting exact geometry` |
| D4 toolbar focus | Inset 2px focus outline, including contrasting outline on a pressed tool | Native browser Tab focus-visible geometry contained in scrollable toolbar, both themes |
| D5 panels | Help and Objects use position-relative trigger anchors | Regression above; measured Help top = trigger bottom +4px |
| D6 Help target | At least 28px | 32×28px measured in both themes |
| H1 duplicate status | Removed Saved/Saving/save-failed duplication from canvas header; page shell retains save status. Reserved canvas status slot stays empty unless View only; no invented reconnect signal | Save transitions still produce CLS 0; no second save-status subscription |
| Slash arrival | Canvas opts into region focus; other blocks retain paragraph focus | Native `checkSlashFocus.mjs` real BlockEditor slash/Enter + non-opted Slider mirror; component pendingCaret test is supplementary |

Properties remain below the sheet so activating them cannot move the drawing viewport under an existing pointer contact; Undo/Redo are above the sheet. The 36px palette remains visible on inactive blocks; only contextual properties/view controls/grip hide. Content ink colors, named swatch values and persisted paper background remain document values, distinct from themed chrome.

### Design-round CLS regression caught before push

The strict reconnect remeasurement caught a regression introduced by this design round: **0.0000014104683195592288** CLS. Attribution names two color-swatch `I` chips changing **10×10 ↔ 16×16** because the pressed selector changed `inset:6px` to `inset:9px`. The worker stopped; the manager approved fixed geometry with paint-only selection marks. Removing the pressed inset rule keeps all chips at 16×16; selection uses an inset outline/checkmark without changing layout. This was caught at authoring time by the existing CLS discipline, not accepted as rounding noise.

The identical genuine withheld-update test now reads **CLS 0** for both one-transaction geometry+color delivery and the multiple-transaction sequence. Live replicas and fresh reload agree; camera, focus, selection and transaction-complete frame assertions pass. Join and shell-save transitions remain **0**; the deliberately unsized canvas mount still fires at **0.06307107438016528** under the new chrome geometry. No sources are excluded and no tolerance was introduced. `design-swatch-cls-before.json` preserves the failing attribution; `design-browser-checks.json` is the corrected rerun. The original outline/handle CLS mechanism and its earlier control remain separately documented.

### Current design evidence (supersedes pre-design chrome numbers)

| Measurement | Light | Dark | Control / method |
|---|---:|---:|---|
| Pressed fill vs chrome | 4.58:1 | 6.14:1 | Computed RGB; not the focus-ring measurement |
| Pressed icon vs fill | 4.58:1 | 6.33:1 | Computed RGB |
| Field boundary vs background | 5.01:1 | 5.51:1 | Computed RGB |
| Chrome foreground vs background | 12.91:1 | 10.54:1 | Computed RGB |
| Chrome stylesheet hex literals | 0 | 0 | Planted `color:#123456`: 1 |
| Opacity-derived text colors | 0 | 0 | Planted rgba(0,0,0,.4), element opacity1: 1 |
| Default-width clipped controls | 0 | 0 | DOM rectangles at 800px; planted 1000px field displacement detects 1 clipped control |
| Focus ring | contained | contained | Focus-visible, 2px solid, −2px inset |

The existing duration meter remains 0 with 123ms control1; alignment at 100/200/400% and 20-cycle drift remain0 with 2px control2. The six light-theme role samples now read 4.58:1 (pressed icon control), 11.85:1 (body button) and 12.91:1 (remaining roles). These replace the old hard-coded 6.70/4.74 boundary claim and pre-token text colors.

Reproduce with the isolated localhost harness, then `node packages/ui/scripts/canvas-measure/measureDesign.mjs` and `node packages/ui/scripts/canvas-measure/measure.mjs --checks-only`. The harness directory, separate config and serve command are unchanged. Numeric theme evidence is in `design-polish.json`; this is not screenshot certification.

**Capture reference: pending manager refresh after push.** Required captures: dark theme; Tab-focused tool with unclipped ring; actual post-slash-insert state showing palette and region focus; before/after slash pair at the same menu scroll state. No worker screenshots, video or public exposure were produced. Visual acceptance, physical IME, screen reader and hardware remain honest PARTIAL.

### Design-round gates

Full root `pnpm run lint`, full production UI build, **264 UI focused tests**, **8 ledger/fence tests**, **216 exact raster cases against the unoptimized reference**, graph exclusion and all six document-byte comparisons pass. The full SDK suite remains **588/588** from the code round, with no SDK changes in this round. Viewer remains **852 B**, raw **1,933,227 B**, SHA-256 **67957e3d2be144ce7e53037e28bb32f263a74d7ac1c138a1ef17d7601bc76198**, design delta **0 B**. Margin remains 4,096−852 = **3,244 B**; with prior F1 estimate2,588, projected3,440 leaves **656 B**. Paint path is unchanged by the design correction; the accepted dense and sustained-input timings/counters remain scoped to their recorded runs.


## Historical delta re-review stop — resolved by the convergence round

Physical bracket shortcuts intentionally match `e.code` (BracketLeft/BracketRight), including on non-US layouts. Help keeps “[ / ]”; Arrange menu and its buttons are the layout-independent route. This is the approved physical-position policy, not a character-based shortcut claim.

`constructCanvasProps` now restores raw shape data without default-filling partial shape JSON. Partial input yields quarantined data and a non-editable canvas rather than silently filled defaults. This preserves malformed input for recovery and avoids throwing inside a block-move transaction. Valid fixture data therefore explicitly includes `...shapeDefaults`; validation was not weakened.

M1 focus, M2 chrome reservation, L3 transparent hint overlay, L4 text blur commit and L6 old-instance cleanup are implemented locally, but this round is NOT complete or pushed. New net-delivery test passes selected-shape deletion: CLS0, control0.06859564237415477, live/fresh equality, Arrange focus restored. With Width focused before a remote quarantine, M2 still fails: focus becomes body, active strips disappear, canvas height584→396 and the following paragraph moves y672→484. CLS0.00542389181066867 (hadRecentInput=false), control0.051603606311044325. Attribution names that following P element, but the canvas shrinking causes the shift; it is canvas-attributable, not a scoping exclusion. Strict assertion retained. Restoring focus in layout effects did not close this focused-field leg. Artifacts: `remote-chrome.json` and `remote-chrome-focused-field-before.json`.

270 focused tests passed before the latest focus-restoration attempt. Root lint passed. Full UI build reached TypeScript and failed at CanvasBlock.test.tsx:195: the window.addEventListener spy mock.calls overload is inferred as DedicatedWorkerGlobalScopeEventMap, so comparing its event key to blur triggers TS2367. This test typing correction remains outstanding; no full-build success claimed for this round. No new committed coordinate measurement, no push; remote remains68d6e990. Harness stopped. Dark non-default-background capture remains manager-owned.



## Historical M2 closure / slash policy stop — subsequently ruled and resolved

M2 now passes on a restarted measurement server with the served module verified against the intended source changes. Remote deletion via production net queue: CLS0, control0.06859564237415477, focus restored to Arrange. Remote quarantine while Width owns focus: CLS0, control0.06962885048835461, focus moves to the canvas region, polite View only, hidden field inert and cannot take focus. Both retain584px canvas height/116px property strip; live/fresh replicas agree. The unit mirror proves local focus departure reclaims the reserved controls and synthetic input cannot mutate the read-only document. There are271 focused tests passing; the Window-typed listener spy fixes TS2367 without as-any or suppression.

Measurement provenance correction: the already-running Vite measurement server failed to invalidate its transformed CanvasBlock module after writes. This is demonstrated directly: the on-disk module had inert={!visible}, whereas the served transform lacked inert. Restarting the localhost server and fetching the transformed module shows inert: !visible before running the final probe. Source/mtime/SHA and stale/fresh served SHA are preserved in remote-chrome-source.json. Previous focused-field failures remain recorded; they are not final-current-code results. Future probes in this round must restart the server after source edits and verify the served module.

NEW EXPLICIT POLICY STOP: SlashMenu.tsx:165–177 documents a deliberate shared behavior: text-less blocks (divider, image, kit widgets) receive a fresh following paragraph and the caret moves there so writing continues. All custom slash entries use insertAfterOrReplace; registry.tsx has no insertion-focus opt-in. Canvas's pendingCaret unit test only proves a request targeted at the canvas is consumed; the real slash flow overwrites that request with the following paragraph. The manager's integrated capture is authoritative: §1 slash-entry focus/ring is PARTIAL. No shared insertion-policy change was made.

Proposed bounded option for a manager ruling: add an optional registration metadata flag slash.focusAfterInsert='block'; only canvas opts in. Preserve the following paragraph and the default text-flow focus for every other type, but make the final caret/focus request target the inserted canvas ID. Verify via actual BlockEditor slash typing/Enter and per-rAF activeElement/focus-ring trace. Alternative destination: editor insertion-focus policy follow-up (manager assigns card ID).

Historical pending item, now resolved by the approved opt-in: §1 canvas slash-entry region focus/ring was awaiting the editor insertion-focus policy ruling. This is distinct from Expand/grid/presence BUILD-5 deferrals. No claim of real-shell insertion focus is made from the component-level test.

Independent checks completed before the slash-policy stop: full UI build, full root lint and271 focused tests pass; viewer raw1,933,227 B/hash unchanged (852 coordinate). Harness stopped. No commit/push; remote remains68d6e990.


## Convergence round — delta review of 68d6e990

This closes the prior delta-review and slash-focus policy stops. Historical stop notes describe intermediate attempts, not the final behavior below.

| Finding | Final change | Proof |
|---|---|---|
| M1 Arrange focus | A persistent Arrange trigger receives focus on Escape and when the selected shape disappears; unavailable actions cannot run | `delta: Arrange %s returns focus to its persistent trigger` (Escape / remote deletion); native net-deletion trace ends on Arrange |
| M2 active chrome lifecycle | Unavailable editing controls keep their last geometry and become visibility-hidden/inert. Header slots, height control and footer geometry are retained. Local deactivation may reclaim them | `delta: remote %s hides editing controls while retaining their geometry nodes`; `M2: quarantine while Width owns focus restores the region and makes the retained field inert`; native measurements below |
| M2 focused-field forgiveness | Before paint, focus moves from a quarantined Width field to the canvas region, with polite “View only.” Retained hidden fields cannot take focus or write | Same unit/native cases; mirror proves local focus departure removes the reserved strips |
| L3 paper background | Empty hints have no background; the stored canvas background remains beneath them before and during first contact | Native dark-mode `#f5e4c3` remains rgb(245,228,195) before/during contact; overlay transparent, planted red overlay control detected |
| L4 text blur | Window blur commits new/edited text through the finish-text path; pen contact teardown remains shared | `delta: window blur commits %s text instead of cancelling it`; `text blur commits words and resets pen contact without promoting a resting touch` (resting touch inert, fresh touch pans40px) |
| L5 keyboard layout | Physical BracketLeft/BracketRight shortcuts are intentional; Help retains “[ / ]”. Arrange menu/buttons are the layout-independent route | Approved disposition; no character-based matching reintroduced |
| L6 unmount | The old instance removes its window blur listener and releases tracked pointer captures during teardown | Strengthened existing component-unmount exit: typed Window listener spies, old node capture released, blur after unmount causes no paint or document update, then remount leg |
| §1 slash arrival | Generic `registerCustomBlock({focusOnInsert:true})` opt-in, set only by canvas. SlashMenu retains the following paragraph but sends the final caret request to the opted block | Native real-BlockEditor slash/Enter integration and non-opted Slider mirror, per-rAF trace below |

### Native slash-focus integration and §1 fidelity

The old component-level pendingCaret test did not exercise SlashMenu's deliberate text-flow policy. The approved seam is **generic registration metadata `focusOnInsert?: boolean`**, false by default. Canvas alone opts in. Other custom blocks still focus a text descendant or the fresh following paragraph; the paragraph itself remains present even for canvas. No editor-wide policy changed.

`checkSlashFocus.mjs` mounts the production **BlockEditor + SlashMenu + registered renderers**, types `/canvas` into the actual contenteditable and presses Enter using native browser keyboard input. It makes **no component focus call after insertion**. Every one of **55 per-rAF samples over 903.10ms** shows the canvas region as `document.activeElement`, Pen pressed, `:focus-visible`, a **2px solid outline**, and the complete ring bounds inside the viewport. The mirror types `/slider` through the same custom-block insertion path: **55 samples over 914ms** all keep focus in the following paragraph, never the canvas. This is native DOM/computed-style evidence of the focused ring, not a screenshot claim.

**§1 fidelity: automated integrated focus/ring behavior now PASS.** Manager-owned state-3 focus-ring capture retake remains pending in the final mini-refresh; the prior honest capture is not relabeled. This is no longer an insertion-policy deferral. `slash-focus.json` retains every frame and the inserted/following block IDs. Reproduce: `node packages/ui/scripts/canvas-measure/checkSlashFocus.mjs` with the separate localhost harness running.

The API matrix was regenerated by `pnpm --filter @book.dev/mcp exec tsx scripts/coverage.test.mts`: **48 catalogue types + 9 plugin blocks pass, no exemptions, no generated diff**. The new option belongs to the React registration API, not the document/MCP block catalogue. Nothing generated was hand-edited.

### Remote-event CLS, focus and inertness together

| Native net-delivery case | CLS | Unsized-canvas control | Focus after | Inertness / convergence |
|---|---:|---:|---|---|
| Peer deletes selected shape while Arrange is open (10-byte packet) | **0** | **0.06859564237415477** | Arrange trigger | Hidden properties inert, attempted hidden-field focus fails; live/fresh equality |
| Peer quarantines canvas while Width owns focus (27-byte packet) | **0** | **0.06962885048835461** | Canvas region, “View only” | Hidden properties inert, attempted hidden-field focus fails; live/fresh equality |

Both cases preserve total canvas height584px, property strip116px, viewport geometry, footer position and the following paragraph. They run after700ms without local input, through production `remoteFrameQueue(doc,'net')`, with actual peer updates and strict unfiltered CLS0. Focus restoration occurs before paint. The local-deactivation mirror still reclaims geometry; read-only semantics and write guards are unchanged. `remote-chrome.json` preserves layout attribution, focus events, packet sizes, controls and reload equality.

The earlier focused-field run was additionally confounded by a stale measurement-server transform: on-disk `inert={!visible}` was absent from the served module. `remote-chrome-source.json` demonstrates stale/fresh served hashes. Final probes restart the measurement-only server and verify four freshly served modules (CanvasBlock, SlashMenu, registration and harness) before running; `convergence-serve-provenance.json` records source paths, mtimes and SHA-256 values. No production Vite config or fs allow-list changed.

The separate withheld-update reconnect tests remain CLS0 (single and multiple transaction sequences), control0.06307107438016528, with transaction-complete frame order and live/fresh convergence. The original outline/handle and swatch CLS failures remain historical artifacts, not accepted tolerances.

### Explicit scope and constructor contract

**Chromium canvas2d, DPR 1, two input classes; this card ships one renderer — WebKit/hardware legs are BUILD-2's.** This is the scope of the previously accepted sustained-input medians1.40/2.20ms and worst1.60/2.40ms; no new sustained-input measurement is claimed here.

`constructCanvasProps` restores shape data without default-filling partial shape JSON. Partial input now yields quarantined data and a non-editable canvas instead of silently filled defaults. That preserves recovery data and avoids exceptions inside open block-move transactions. Valid test fixtures explicitly include `...shapeDefaults`; this is the reason for that fixture change, not relaxed validation. The full SDK validation-case set remains unchanged.

### Convergence validation

Full UI production build, full root lint, **272 focused tests**, **8 ledger/fence tests**, **216 exact raster cases against the unoptimized reference**, fresh-server slash/mirror and remote-chrome browser probes, and six document-byte comparisons pass. Raster coverage remains72 cases at each DPR1/1.5/2. Graph checks exclude the editor/remote queue from the viewer and the measurement harness from both production graphs. Viewer remains **852 B**, raw **1,933,227 B**, SHA-256 **67957e3d2be144ce7e53037e28bb32f263a74d7ac1c138a1ef17d7601bc76198**; this round adds **0 shared-side bytes**. Margin:4096−852=**3244 B**; prior F1 estimate2588 projects3440 total, leaving**656 B**.

Artifacts: `convergence-*.log`, `convergence-validation.json`, `convergence-serve-provenance.json`, `slash-focus.json`, `remote-chrome.json`, refreshed design/raster/graph evidence. The separate harness remains localhost-only; no worker screenshots/video/public exposure. Manager capture refresh, physical IME, screen-reader experience and hardware remain explicitly scoped manual remainders. Full-suite push-hook results are recorded after delivery.

## Final reservation correction — review of 44935994

This section supersedes the overly broad retention description in the preceding convergence round. **Reserved geometry exists only for chrome visible during the current activation that becomes hidden by a remote change while active.** Static readonly (page permission or already-quarantined data) renders a lean Pan-only toolbar, without history/height/Arrange ghost slots. Local deselection, tool changes and deactivation reclaim immediately. Canvas-local transaction observation distinguishes remote scene changes; local selection/tool changes reset the retained properties context. No shared transport policy changed.

The strict original `queryByLabelText(...).toBeNull()` assertions in **“design: inactive controls hide; active properties follow the tool and selection”** are restored. The prior switch to role queries allowed hidden leftover controls and therefore asserted the regression rather than the contract. Remote retention assertions remain strict and separate.

| Correction | Committed regression |
|---|---|
| Static readonly is lean | `static readonly %s has only Pan and no editing ghost slots` — page permission and loads-quarantined |
| Local transitions reclaim | Restored design test; `local deselection and a local tool change after remote deletion reclaim properties` |
| Remote changes retain, focus survives, controls are inert | Existing net-deletion/quarantine tests; focused-Width test also checks disabled fieldset; native Chromium checks the field itself matches `:disabled` and cannot take focus |
| Arrange closes on quarantine and stays closed on recovery | `quarantine closes Arrange and local navigation reclaims reserved editing chrome` |
| Empty text never publishes | `empty/nonempty text on %s blur commits only words` — window and click-away; empty: zero shapes, unchanged encoded document, zero update events, no undo entry; nonempty: one shape plus fresh-replica equality |
| Insertion focus is now CI-gated | `slash insertion focuses the opted region or non-opted paragraph: %s` — production BlockEditor contenteditable/native beforeinput → SlashMenu → registered renderer, Canvas and Slider mirror |

**Blur policy:** any blur out of the canvas (click-away) and window blur commit only non-empty text; empty text silently cancels. Escape remains explicit cancellation. This approved click-away disposition exceeds the original window-blur-only L4 wording. Arrange's relocation into the footer is an explicitly accepted layout change. Hidden retained properties use a native disabled fieldset as well as inert, so disabling does not depend on React 19 inert support; hidden toolbar/history/height/Arrange controls are disabled too.

| Refreshed native measurement | Result | Deliberate control / scope |
|---|---|---|
| Remote deletion, selected shape, Arrange open | CLS **0**; focus restored to Arrange; live/fresh equal | Unsized-canvas CLS **0.06859564237415477** |
| Remote quarantine, Width focused | CLS **0**; canvas region focused; polite View only; field disabled and cannot take focus; live/fresh equal | Unsized-canvas CLS **0.06962885048835461** |
| Real slash Canvas insertion | **55/55 frames**, through **910.80ms**, region focused, Pen pressed, 2px solid focus-visible ring inside viewport | Slider mirror **55/55 frames**, through **905.20ms**, following paragraph focused |
| Raster | **216 exact comparisons**, 72 each at DPR1/1.5/2 | Same-machine native-resolution **unoptimized full-repaint** reference, never optimized self-comparison; settled identity and gesture-scoped differences; cleared-reference controls fire |

Native browser evidence is numeric/DOM evidence, not a worker screenshot claim. Manager capture refresh remains separate. Both remote CLS rows preserve canvas584px/property116px and footer/following-paragraph positions. `remote-chrome.json` now includes `hiddenFieldDisabled:true` for both. Fresh-server transformed source provenance is in `reservation-serve-provenance.json`. Reconnect/design controls and six document-byte comparisons were rerun successfully; no document bytes moved. The full SDK validation set remains unchanged.

**Validation:** full UI production build, exact root `pnpm run lint` (including full-package UI lint), **280 focused tests**, **8 ledger/fence tests**, raster and graph fences pass. API matrix generator passes48 catalogue types +9 plugin blocks, no exemptions and no generated diff. Viewer coordinate remains **852 B**; raw **1,933,227 B**, SHA256 **67957e3d2be144ce7e53037e28bb32f263a74d7ac1c138a1ef17d7601bc76198**. This correction adds **0 shared-side bytes**. Margin remains4096−852=**3244 B**; prior F1 estimate2588 projects3440 total, **656 B** remaining. `reservation-*.log` records these checks; full pre-push suites run again before delivery.
