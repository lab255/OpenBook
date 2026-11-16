# BUILD-3 — headless core and review fix round

Audited at: 6b6106fabbade7d77bd10797ed89f5b2f4d1e394

PR: https://github.com/lab255/OpenBook/pull/448. Latest reviewed head: 9adc3567115801e5a9f15c8b5b5b89705652ba17. Manager: thr_yu4up34sb7. Card: OB-1081. This report supersedes the prior partial/stop reports; historical evidence is retained.

## Result

Headless v1 nested schema, validated scalar and structural commands, SDK fractional ordering, immutable defensive scene reads, anchored pressure batches, and a chronological page/canvas journal are implemented. No canvas renderer, toolbar, or owner-facing surface is registered. The manager-authorized synchronous generic history extension is installed only by reactiveBlocks, the fenced app wrapper. Shared editor modules contain no canvas imports or canvas-specific types. With no extension, the viewer constructs the same root UndoManager as before; effect ownership and StrictMode cleanup remain intact.

The review fix round repairs the erase/concurrent-edit race, preserves token-eligible semantic history after root restoration, validates only command targets, and expands the proof suite. Missing required scalars are never rendered from defaults: the reader names shape/key in diagnostics and quarantines the shape. Restore repair supplies captured valid values before any scene observation.

## Review findings and mechanism

The known D3 race was reproduced against 38035434 in both client-ID orders: A erases s, B concurrently commits x=55, replicas exchange, then A undoes erase. Both replicas lacked x/op:x despite an applied result. Baseline seeds/operations/states are in `review-round/known-erase-race-before.jsonl`.

Erase records validated scalar/token pairs and refreshes them before redo re-erases. Pressure recovery now resolves LIVE batches at restoration time, not a captured batch inventory (fix round 2). A temporary, canvas-scoped beforeObserverCalls hook repairs a restored erase before type observers, afterTransaction handlers or update consumers see it. All scalar and pressure writes share ONE history-excluded local transaction. Pinned Yjs 13.6.31 encodes the original update from the live store; tests independently deliver every update to the other replica, checking complete geometry and pressure on every observed transaction. No manager-wide ignoreRemoteMapChanges flag is changed.

The pressure stop was classified by the manager as an **explained recovery gap, not a reopened D3 anomaly**. The proof now demonstrates the exact distinction: restored points have a new type identity; old anchors resolve to the original points before erase; strict resolution does not address the restored type after undo. Default Yjs resolution can follow local redone pointers on A, while B receives no such pointers and cannot follow them. The repair explicitly disables following undone deletions when checking old anchors, then recovers the live offset through local redo pointers and creates fresh relative anchors against the restored points. Existing batch IDs and quantized pressures are retained. This recovery-only replacement is authorized by the manager; normal appends never rewrite prior batches.

The two pressure-race tests assert distinct identities, local/default versus strict/remote resolution, identical reconstructed widths from two pressure batches on BOTH replicas, editable=true, paired scalar tokens, redo erase, and a second undo with valid pressure. The additional seed races verify explicit seed tokens in both client-ID orders. The move→erase→undo→undo→redo→redo test verifies token lineage across restored maps. Semantic replay uses token eligibility, not the old CRDT object identity.

## Performance precondition

Resolution caches are scoped to one synchronous command/replay. Each addressed canvas is found once; each addressed shape and its points are validated once. The command path does not materialize, sort or copy the whole scene for each field. Cache lifetime ends before any subsequent remote update can make it stale.

Five trials per workload, 500 strokes, 50 or 1,000 point pairs per stroke, fractional coordinates i/10, x/y move then undo and redo. Timings are headless command costs, excluding rendering/network observers. All samples and redo timings are retained in `review-round/performance-*.jsonl`; scripts/canvasHistoryBench.ts reproduces the method. Baseline processes briefly overlapped; after runs were sequential. These local measurements are not hardware/UI latency acceptance.

| Workload | Operation | Before median / worst (ms) | After median / worst (ms) |
| --- | --- | ---: | ---: |
| 500 × 50 pairs | Single move | 2.68 / 10.00 | 0.14 / 1.53 |
| 500 × 50 pairs | Move all 500 | 836.86 / 839.10 | 7.48 / 24.39 |
| 500 × 50 pairs | Undo all 500 | 1,709.31 / 1,819.21 | 8.44 / 12.79 |
| 500 × 1000 pairs | Single move | 14.63 / 23.98 | 0.19 / 0.33 |
| 500 × 1000 pairs | Move all 500 | 6,132.49 / 7,955.76 | 12.39 / 21.90 |
| 500 × 1000 pairs | Undo all 500 | 12,621.09 / 13,609.72 | 5.97 / 34.97 |


The dense workload's unfixed **12,621.09 ms median / 13,609.72 ms worst undo** remains visible: after the fix it measures **5.97 ms median / 34.97 ms worst**. This comparison satisfies the manager's requirement to measure the worst workload rather than hide it behind standard-board averages.

## Viewer byte discipline

Clean audited baseline: **1,932,942 B**, coordinate **567 B**. Previous PR and fixed build: **1,933,102 B**, coordinate **727 B**. Total seam delta **+160 B**, fix-round delta **0 B**, below the +300 B stop threshold. Artifact SHA-256 remains `5c78d33fbe54ad95397b47db03887877670ffe9a0e5104b3f77b3df84b838dc7`. No canvas modules/app wrapper enter the emitted viewer graph; all 7 ledger/fence tests pass. The 4,096 B coordinate guard and feature ledger remain unchanged.

An intermediate build picked up an unused selection CSS utility from a benchmark comment (+52 B). Removing that incidental utility restored the exact prior artifact; no guard or product implementation was contorted to meet the threshold. Final comparison: `review-round/viewer-comparison.json`.

## Validation

- SDK was built after provisioning in the initial round; SDK sources/dependencies are unchanged.
- **5 focused files / 89 tests passed** (latest fix round 2): canvas proof suite, low-level D3 preflight, registration/StrictMode lifecycle, existing relay and saver suites.
- **7/7 ledger/fence tests passed**; viewer build passed.
- UI TypeScript and targeted ESLint passed. Node-only diagnostic capture follows the repository's Vitest-only import convention; no browser Node dependency is introduced.
- Geometry invariants now cover x/y/w/h, start/end X/Y, basisW/basisH positivity, even point-pair length and finite point values, including every observed structural-race transaction.
- Latest outputs are in `_evidence-build3/review-round2/{focused-tests,ledger,typecheck,lint,viewer-build}.txt`; the exact 32 matrix names and outcomes are in `review-round2/matrix.json`. Fix-round-1 measurements and logs remain in `review-round/`.

## Architecture proof mapping

All names below are in `packages/ui/src/blockeditor/canvas/core.test.ts`.

| Spec proof item | Automated test name |
| --- | --- |
| Token/value pairing, differing operation lengths, inverse token reuse | Required proof: token/value winners stay paired with different operation lengths and inverse token reuse in both client-id orders |
| Both client-id orders | Same pairing test; Required proof: winning and losing moves in both client-id orders |
| Winning and losing moves | Required proof: winning and losing moves in both client-id orders |
| Redo after remote move | Required proof: redo after remote move skips mismatched tokens |
| x-only versus x/y | Required proof: x-only versus x/y preserves independent fields and dimensions |
| Two edits, two undos, two redos | Required proof: two sequential local edits then two undos/two redos restore token lineage |
| Remote erase before undo | Required proof: remote erase before undo never resurrects geometry |
| Append+pressure undo | Required proof: append+pressure undo and redo across replicas |
| Erase restore after semantic edits | Required proof: erase restore after semantic edits |
| Grouped multi-selection | Required proof: grouped multi-selection captures actual commit baselines and one journal entry |
| Cancellation | Required proof: cancellation preserves pointerup-only document/history contract (UI preview-discard placeholder pending F3) |
| Interleaved history, bounded root dispatch | Required proof: interleaved page/canvas history and bounded no-op root dispatch |
| Cross-provider relay undo | Required proof: relay delivery of scalar and raw root undo/redo uses two connected providers exactly once without echo |
| Invalid/fallback docs | Required proof: invalid/fallback docs remain readable without mutation and reject editing |
| Every observed scene complete/finite | Required proof: every observed post-transaction scene has complete finite geometry |
| Decisive D3 example | Decisive D3 example: seed inverse, winner redo, losing undo and later remote move (A=%i, B=%i) |



Review-specific tests are named `Review D3 race…`, `Review D3 seed race…` (each client-ID order), `Review token lineage…`, `Review diagnostics…`, and `Review order ties…`. Equal ord values, deterministic (ord,id) sorting and the actual rebalance branch are asserted explicitly. The decisive example is parameterized for both client-ID orders; the original B-wins-40 outcome remains the A=10/B=20 case.

## Decisions, limits and anomaly watch

- Per manager ruling, the app-registration seam is authorized; no asynchronous installation or second visible history is introduced.
- Full-axis balancing through keysBetween includes tied runs and costs O(k); it is not claimed to be a 25 B operation.
- Forward scalar writes use fresh UUID tokens; inverse replay restores captured token lineage, with explicit canvas:seed for seeds. Restored maps are eligible by token, not old object identity.
- Canonical fallback recovery authority is not invented. Fallback data is safely diagnosed/read; only valid integrated targets are mutable.
- Pointerup-only publication remains the policy. The headless cancellation test proves no publication, remote rewind or history change. **Actual UI preview discard is explicitly a placeholder pending renderer/F3 work**, not claimed as automated UI coverage; early-published stroke cancellation remains disabled.
- Tests cover bounded concurrency cases, not exhaustive verification. Deliberately throwing raw-manager operations are not injected. Full repository tests and hardware/UI/export acceptance were not run.
- The original reported geometry defect is fixed in named race tests. The pressure result and initial over-strong identity assertion are explained and proven; the original failing logs remain in `review-round/race-tests.txt` and `pressure-identity-assertion.txt`. The stale `review-anomaly.json` dump was removed in fix round 2, and future failure traces go to a uniquely named OS temporary directory. **No new unexplained undo result occurred after the manager-authorized repair; the historical D3 anomaly gate remains closed per the manager ruling.**


## Fix round 2 — generalized restoration model and complete erase matrix

**Root-cause model:** Yjs root undo/redo can recreate point items or their containing types, while stored relative anchors still name earlier identities and may resolve only through the undoing replica's local redo pointers. Recover every stale live anchor-bearing batch at restoration time; erase snapshots are authoritative only for scalars at their latest capture, never for the inventory of pressure batches that may have changed between history legs.

**One pressure mechanism closes both HIGH findings.** The same beforeObserverCalls repair runs for root undo AND redo, traverses live canvas batches once per root dispatch, and checks strict identity. If strict resolution fails but following local undone deletions yields a valid offset, it creates a fresh portable anchor against the live restored points type. This handles original erase races, remote appends after a restore, later redo/undo cycles, whole-canvas page deletion, and root redo of a newly created pressure stroke. There are no shape-erase versus page-delete pressure special cases. The scan is outside scalar command/replay; the target-only scalar performance fix remains unchanged.

**Snapshot choice: both generalized re-anchoring and recapture-on-redo-re-erase.** Pressure offsets/quantized values come from the live restored batch, so new remote batches cannot be omitted by a stale erase snapshot. Before a redo re-erases a shape, scalar snapshots are captured again from current validated geometry/tokens. Named concurrent re-erase tests prove that x=80 (the latest baseline), not original x=20 or a later losing x=99, is restored in both client-ID orders.

**Diagnostics, not cleanup exceptions.** An invalid pressure batch is skipped and reported with canvas, shape and batch ID through `HistoryResult.diagnostics` and `CanvasHistory.diagnostics`; repair no longer aborts beforeObserverCalls. A named invalid-batch test proves normal afterTransaction observers and update delivery still run, both peers agree, and the preexisting degraded state is explicitly diagnosed. Recovery writes remain one excluded local transaction before observers; the same raw-update propagation mechanism is retained.

The complete erase matrix ran green in one suite on the first generalized repair:

| Dimension | Values |
| --- | --- |
| Erase level | Shape; whole canvas page block |
| Client IDs | A=10/B=20; A=20/B=10 |
| History | Serial erase/undo; erase/undo followed by TWO redo/undo cycles |
| Remote changes | None; append; scalar edit; append + scalar edit |
| Delivery and final check | Every update delivered independently; both replicas checked; third replica loaded from final binary state in EVERY case |

This is **32 named matrix cases**, enumerated with passed outcomes in `_evidence-build3/review-round2/matrix.json`. Remote changes occur before the initial erase and between each restoration and re-erase. Both separately named HIGH reproductions are retained in both client-ID orders. Existing concurrent erase/edit races, new concurrent scalar-recapture races, and root-REDO restoration cases also pass. The fixture now resolves the live block after page restoration, so it cannot silently inspect a detached old shapes map.

Latest validation: **89/89 focused tests, 7/7 ledger/fence tests, UI typecheck and lint pass**. Viewer remains **1,933,102 B**, coordinate **727 B**, total seam **+160 B**, fix-round-2 delta **0 B** and the same SHA-256 as before. Fix-round-1 before/after scalar benchmarks above remain on record; this round did not change that scalar path or claim new root-history timing measurements.

**Hygiene:** the stale committed `_evidence-build3/review-anomaly.json` is removed. Test failure capture uses `mkdtempSync(tmpdir())`, prints the evidence path, and preserves seeds/update bytes/states outside the repository.

**Decision owed to the UI card:** `readCanvas` marks the entire scene `editable=false` when any shape is quarantined, while mutation APIs validate only addressed targets and can still edit healthy shapes. This asymmetry is intentional to record, not silently adjudicated here: the UI card must decide between board-wide edit gating and per-shape affordances, and surface history repair diagnostics. Page write permission continues to gate either path.

**Anomaly watch / iteration cap:** one generalized mechanism closes both findings with a green full matrix. No third repair round was started and no new unexplained undo result occurred. No permanent fidelity degradation is being accepted for valid restored batches.
