# BUILD-6 canvas export acceptance

Audited at: `99cd2dc77d8955fbc8929e03a91800a5c3c6e4f7`.

Owner ruling 2026-11-22 via PM² authorizes exactly **9,413 B** in the non-Motion endpoint coordinate, with no inferred margin. **Any growth past 9,413 is a NEW OWNER RULING.** The superseded 4,096 is **CALIBRATED-TWO-CONTRACTS-AGO**, not a miss: it correctly calibrated the pre-option-B design at 59c49f80; curve fidelity, quarantine-never-silent-default and producer projection were subsequently ruled in. The new measurement prices those contracts.

| Quantity | Bytes | Scope |
| --- | ---: | --- |
| Historical slice | 2,981 | Raw IIFE delta at 59c49f80 |
| Historical coordinate | 3,159 | Endpoint consumption at that artifact |
| Superseded authorization | 4,096 | Correct calibration of the earlier design |
| Historical projected remainder | 656 | Planning, using the 2,588 estimate; not current measured headroom |
| Current authorization and measured coordinate | 9,413 | Complete BUILD-6 artifact; zero inferred margin |

The complete raw artifact is 1,941,788 B = pinned historical anchor 1,932,375 + 9,413. SHA256: `b8b9ec51b52eeed2ce0886c3b636743d1f460b0eef4d51d16b460ea8ed4a14c8`. The reproduced base is 1,933,227 B, making the slice delta 8,561 B. Coordinate sequence: 567 → 727 (+160 history) → 765 (+38 projection) → 780 (+15 construction) → 852 (+72 catalogue) → 9,413 (+8,561 complete slice) = authorization. Motion stays exactly 211,511 rendered B. Aggregate growth is 95,275 raw B, leaving 166,869 of the 262,144 allowance; the endpoint decision does not trade off other work. Canvas is non-Motion, outside the direct-Motion-adopter 2,048 B own-code guard; R2 usage acceptance remains separate.

The consumer row stays **UNLANDED through merge**. A tiny post-merge follow-up records the squash-merge SHA on main, never the branch SHA. Commit identity is provenance metadata, not Git-existence/ancestry validation. Raw deltas reconcile exactly; normalized module ownership is a disjoint partition regenerated from the final graph and bound to the artifact and graph hashes. Shared modules have one owner; repeated instances aggregate rendered diagnostic magnitudes. Rendered bytes never enter raw arithmetic.

Independent clean-build subtraction controls against this same artifact justify the authorization: curve/pressure ladder 1,192 raw B; quarantine 1,886; producer projection 309; camera 659; kept-static handoff 144. These are **non-additive marginal prices**, not shipping variants. Removing any of them violates a ruled contract. Authoring constructors and editing eligibility are absent; committed-input scalar, arity, q, bounds and ordering validation remain load-bearing. Serializer/Markdown packaging stay export-side.

## Acceptance coverage

| Contract | Verification | Boundary |
| --- | --- | --- |
| Five kinds, curves/q, ordering, fonts, clipping | `checkParity.mjs`: 180 exact RGBA comparisons, clear-surface controls, DPR 1/1.5/2, zoom .5/1/1.25/2/4, widths 300/300.5, generic sans/serif/mono | Tested Chromium/font environment; no equivalence assumed with app Inter |
| Malformed input/empty scene/projection | `canvasScene.test.ts`, fresh Yjs import and unchanged source bytes | Committed input quarantine; viewer never edits |
| No-JS and hydration | `checkHandoff.mjs`: PNG before boot, exact PNG/live pixels and figure rects, original boot, firing CLS controls | Ten runs each of preceding/following/surrounding paragraphs at 1100×900, DPR1; earlier single-canvas DPR1/1.5/2 legs |
| Mixed-document layout | Exact paragraph AND figure rect equality across handoff | Top-level paragraph compositions, not arbitrary nested blocks |
| Local interaction/remount | `checkInteraction.mjs`: native pan, keyboard zoom/reset, original fallback survives remount, destructive-copy control | Local repaint, no physical-presentation latency claim |
| PDF | `checkInterop.mjs` calls real `toPdf` paged/continuous; `checkPdf.py` independently decodes, checks exact embedded RGBA, visible placement, nonblank rendered pages, surrounding selectable text | Canvas text is rasterized; other PDF text uses existing PDF font mapping |
| Markdown | Actual ZIP read by Marked 18, relative PNG decodes and matches source bytes, text alternative present | One real reader, not every Markdown implementation |
| Clipboard HTML | Actual ClipboardItem native-pasted into Chromium contenteditable; image decodes and matches bytes, surrounding text retained | One HTML paste consumer; no universal external-editor claim |
| Source-island reimport | Exact island data and fresh decode, unchanged encoded source bytes | Export artifacts gain PNG payload; persisted schema unchanged |

Mixed-layout diagnosis: PNG already had `display:block`, disproving the inline-image baseline hypothesis. Static paragraphs used 24px line boxes and 9.6px collapsing margins; hydrated paragraphs used the same line box with 4px padding on each side. Matching static paragraph boxes within canvas exports removes the 1.59375px figure shift without offsets. Export-only CSS leaves the viewer artifact byte-identical. CLS cannot reliably observe replacement-tree movement, so exact geometry comparisons supplement it. Controls enlarge a stable viewport to move the existing summary/following content.

Manager-side design review runs first on the initial push; polish captures, token/legibility judgments, hardware/iPad and R2 usage judgments remain review/epic work. No public harness URL is exposed.

## Reproduction

Build prerequisites in workspace order (`pnpm run build:libs`), then `pnpm test`, `pnpm lint`, and `pnpm typecheck`. The viewer ledger tests exercise the actual artifact plus +9,413/+9,414 and −506/−507 boundaries. Full production UI build includes viewer and TypeScript.

From `packages/ui`, build this harness with `pnpm exec vite build --config scripts/canvas-export-measure/vite.config.mjs`, then preview with the same config (loopback port 5186). Browser scripts launch a fresh Chromium per case with the documented sandbox-compatible single-process recipe. Set `BUILD6_HANDOFF_OUTPUT` to an evidence JSON path; `BUILD6_MIXED` accepts `preceding`, `following`, or `surrounding`; `BUILD6_RUNS` defaults to 10. `BUILD6_INTEROP_OUTPUT` names the interop JSON and adjacent PDFs/reference PNG. Run `checkPdf.py` with that path in a separate Python environment containing PyMuPDF. Source stamps, built artifact hashes and output readbacks are asserted.

`finalAccounting.mjs` takes `BUILD6_ACCOUNTING_OUTPUT`, regenerates the partition and verifies exact ruled raw length. `measureCosts.mjs` takes `BUILD6_COST_OUTPUT`, builds deliberately noncompliant independent subtraction controls and restores the byte-identical full artifact; it is evidence tooling, never a release configuration. Do not run these concurrent with production builds.

Server-suite environmental comparison: the full sandbox run had 1,452 passing server tests and one `mirror.integration.test.ts:128:55` failure accompanied by EMFILE watch exhaustion. Base 99cd2dc7 reproduces that same assertion/error class with the same dependency environment. Head and base each pass all three mirror tests unsandboxed. Server/SDK/MCP/lockfile deltas are empty. No server test was changed; the original sandbox failure is not represented as a green run.
