# Export-viewer motion accounting

The app uses eager Motion independently. The viewer provider uses non-strict LazyMotion/domAnimation and seeds the lazy renderer. `motionBoundary.mjs` checks the resolved app/viewer graphs; `motionGraph.mjs` checks the viewer's emitted modules after tree shaking. The exporter intentionally carries viewer JS as an inert raw asset in the app graph.

`motionFeatures.json` records historical, ordered-integration measurements, not independent package sizes. Never sum rows to forecast a future total: shared code and minification interact. The FF-6 seed measurements can be reproduced with `pnpm exec vite build --config vite.motion-calibration.config.js --mode lazyRuntime`, then `domAnimation`, then `renderer`. Outputs and module inventories land under the web test harness's ignored `generated/calibration-*` directories. These commands never rewrite the ledger.

To introduce a feature, first measure the current production bytes, then build a test-only calibration variant containing that feature. Record its ordered before/after bytes and previously unledgered emitted Motion module paths/exports in a new named row, with its introduction date/card. Preserve historical rows. Intrinsic MotionDiv/MotionButton/etc wrappers from the lazy-elements module are one renderer feature, not separate features. The production build must still fit the original 1,846,513-byte baseline plus the transportability allowance in `motionFeatures.json` (262,144 bytes, owner direct confirmation 2026-10-28); adding a row grants no budget exemption.

The separate 2,048-byte block ceiling measures UTF-8 rendered module code, before final bundle minification. It charges a direct Motion adopter under `src/blockeditor` plus new non-Motion dependencies, traversing zero-code re-export facades too. Initial shared modules and separately ledgered Motion machinery are excluded. This distinguishes a small block's own code from a large new shared feature. The ordinary/layout calibration tests exercise both budgets independently.

The full-chain fixture and budget controls are separate test builds. Neither their code nor their module-graph assets are shipped in the viewer script. Production fixture exclusion is checked against actual built bytes. The JSON graph sidecar is build/test evidence only and is never embedded in exported HTML.

The ceiling moves, the ledger stays: layout-class motion is export-legal but still needs a measured feature row when adopted. It cannot run before hydration; the element is present immediately (snap on load) and animates only on subsequent changes. This is intended behavior accepted by owner direct confirmation on 2026-10-28, not a regression. Every layout-class disposition must state that observable explicitly.

FF-4/FF-6 seam amendment (2026-10-29): the 2,048-byte guard is a marginality test for the next block (89 × 2KB), not a one-time infrastructure cap. Chrome is exempt from the per-block cap by scope definition, not by exception. FluidHover triggered this clarification at 3,977 own bytes. Chrome remains governed by the feature ledger and total ceiling; transitive non-Motion helpers remain charged to adopting blocks.

Reproduce the seam measurements with production NODE_ENV and calibration modes `ff46-before`, `ff46-shell`, `ff46-values`, `ff46-reduced`, `ff46-final`, `ff46-eager`, in that order. These test-only variants remove APIs solely to measure ordered integration; the shipped component retains all real runtime APIs. The hook rows account for new framer-motion React wrappers, not the already-ledgered motion-dom primitives. The `animate` row includes its newly emitted standalone sequence/object machinery. Never sum historical rows to predict a future total.

The named transitive-closure regression checks every emitted Motion module reachable from `viewer/index.tsx`, including shared chrome; removing any module authorization must fail. CI caught the combined tree that neither branch's standalone verify contained. This closes the fixture-coverage gap; checking independently green branches cannot replace verification of their integrated tree before merging.

CARD-13 endpoint amendment (2026-11-09, option b): the former exact assertion
`lastRow.afterRawBytes === measuredProductionBytes` is superseded by separate
Motion graph accounting and a bounded non-motion window. Historical feature rows
and their adjacency remain intact. Clean builds on Node 24.14.1 / pnpm 10.28.2
measure 1,932,118 B at `38e5f30c` and 1,931,612 B with FF-7e
(`070ab4b4..daf87bf9`) applied. A third clean build, on the FF-7a control-ladder
branch stacked on this amendment (`f444c560`), measured 1,932,218 B in CI —
+100 B from declaring the four control heights explicitly in the `.dark` block.
Both have a 974,125 B graph sidecar, 3,215,446
rendered module bytes, and 211,511 rendered Motion module bytes. Generated viewer
JS and graph files were moved out before rebuilding; SDK artifacts were built
first. The post-FF-7e measurement used a freshly installed archive with the
`070ab4b4..38e5f30c` changes applied, leaving worker sources untouched.

The ledger now requires exactly 211,511 Motion bytes and permits raw bytes in
`[lastRow.afterRawBytes − 506, lastRow.afterRawBytes + 571]`: a two-sided window
around the historical endpoint, sized from measured non-motion changes only
(−506 B FF-7e CSS/string shrinkage, +100 B FF-7a explicit dark ladder
declarations, +471 B CARD-10 command-palette polish). This is not a new feature
discount.

### Growth widening 2026-11-10 (CARD-10, owner ruling)

`nonMotionGrowthBytes` moved 100 → 571 by owner ruling (thr_yipm6kxdnm,
2026-11-10), precedent `9924500d`. The +471 B is the CARD-10 command-palette
polish measured on a clean `build:viewer` with generated JS and graph deleted
first: viewer CSS payload 223,775 → 224,246 B, while viewer JavaScript
(1,706,571 B) is byte-identical before and after, the Motion module-byte sum is
unchanged at 211,511, and no new emitted Motion modules exist.

This widening is legal non-motion movement, not a feature discount: the window is
sized from measured non-motion CSS only, and every independent guard still
applies unchanged (exact Motion byte sum, module/export coverage, the 2,048 B
block-own-code ceiling, the 262,144 B transportability ceiling, and the
historical calibration seed). The alternative — narrowing the edit-only
`SlashMenu` emission (7,319 B pulled into the viewer through `BlockEditor`) — was
declined because a graph entry's bytes are not removable-code bytes: shared
modules and adopter rules apply. It remains filed as an optional follow-up
labelled architectural-with-no-proven-saving. Trade-off: the three
measurements must be maintained; any drift beyond the window requires a new
explicit decision rather than a silent edit. The aggregate byte sum does not
identify features, so module/export coverage remains independently mandatory.
Fixtures reject a missing `animate` row even inside the window, altered Motion
bytes, and either window boundary crossed by one byte. The actual eager/layout
fixture still rejects unledgered Motion and
exceeds the marginal calibration limit; the separate own-code fixture still
rejects a 2,049 B block dependency closure. Motion machinery itself is deliberately
excluded from own-code charging, so a new Motion feature need not fail that
independent guard by itself.

`preAdoptionRawBytes` (1,846,513), `blockOwnBytesCeiling` (2,048),
`hardDeltaCeiling` (262,144), the historical `calibration.seededProductionRawBytes`
(1,922,068), and baseline script hashes stay unchanged. The calibration test's
local `seeded` continues to read today's production artifact by design.
