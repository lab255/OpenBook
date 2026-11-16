# BUILD-3 — PARTIAL, stopped at viewer boundary

Audited at: 6b6106fabbade7d77bd10797ed89f5b2f4d1e394

Branch: bb/execute-build-3-canvas-task-thr_6mveyr65s7
Manager: thr_yu4up34sb7. Card OB-1081.

## Result

Headless BUILD-3 implementation complete under the manager's integration ruling. The app wrapper synchronously registers a generic history factory; shared editor modules contain no canvas imports or canvas-specific types. The unregistered viewer path still constructs its original root UndoManager. The extension owns the same root scope in the existing effect lifecycle.

Clean baseline build at the audited base: **1,932,942 B**, nonMotionGrowthBytes **567 B**. Implementation viewer: **1,933,102 B**, coordinate **727 B**. **Measured seam delta +160 B**, below the manager's +300 B stop threshold. The 4,096 B guard and ledger are unchanged. The complete ledger suite passes, and the emitted viewer graph contains neither canvas modules nor the app wrapper. Artifact SHA-256 comparison is preserved in `_evidence-build3/viewer-comparison.json`; the PR records the base/head commit comparison.

The earlier direct-import fence failure was stopped and reported. The manager explicitly authorized app-wrapper injection, superseding the brief's no-app-registration restriction for this generic history seam. Historical failing evidence is retained in `ledger-failure.log`, `viewer-fence.json`, and `core-tests.log`; it is not the current acceptance result. No visual canvas block registration, renderer, toolbar, or owner-facing surface was added.

## Implementation

- D2 nested schema, explicit defaults, scalar validation, negative extent clamping, immutable defensive scene projection and safe JSON fallback reading. Invalid/fallback input is mutation-gated, not independently rehydrated.
- Existing SDK keyBetween/keysBetween with deterministic (ord,id) ties and full-axis balancing when tied placement or >48-character keys require it.
- Semantic command capture of actual commit-time before values/tokens; per-field UUID tokens, paired writes, metadata exclusion from the root UndoManager, explicit seed token, conditional inverse and redo subset.
- One chronological journal, root event integration, bounded raw stack dispatch with detach/restore in finally; root structural insertion/erase/append transactions.
- Pressure batches anchored to the points Y.Array, <=64 pairs, quantized pressure, defensive pressure reader.
- Registered known-local history origins feed the existing relay queue and saver backstop; no remote echo, no second queue.
- Synchronous app-wrapper registration through historyExtension.ts; effect-owned hook dispatch, generic availability and history access, and a live read-only predicate. Canvas remains excluded from the viewer graph.

## Decisions within the spec

- Pointerup-only publication. Cancellation discards local preview; early-published stroke streaming and its conditional F3 cancellation path remain disabled.
- Rebalance the complete deterministic axis, which includes the tied run, using existing keysBetween. This is O(k), is journaled semantically, and is not described as a 25 B operation.
- Explicit seed token is `canvas:seed`; forward writes use fresh crypto.randomUUID tokens. No timestamp ordering.
- Replaced nested map identities cause semantic history no-ops, in accordance with §3; history does not resurrect a replaced shape.
- Fallback recovery authority is not invented. The reader permits safe inspection; mutations require a valid integrated v1 tree.
- Raw undo origin is recognized through an effect-lifetime registration, rather than emitting duplicate update events or changing transaction origin.

## Validation and evidence

Provisioned with CI=true pnpm install and SDK build. Base HEAD equals fetched origin/main at 6b6106fa. Install had non-blocking shared-git husky configuration and missing server/mcp binary warnings; those artifacts are unnecessary for these checks.

- **5 focused test files / 40 tests passed**: canvas core, initial D3 gate, registration/StrictMode integration, existing relay and saver suites. `_evidence-build3/tests.log`.
- Final canvas-only recheck after removing a live source reference from the immutable reader result: `_evidence-build3/canvas-tests.log`.
- TypeScript and targeted ESLint: exit 0. Empty success logs in `_evidence-build3/typecheck.log` and `lint.log`.
- Baseline and implementation viewer builds: success; respective logs in `_evidence-build3/baseline-viewer-build.log` and `viewer-build.log`.
- **All 7 ledger/fence tests passed**, including explicit exclusion of canvas/app wrapper, endpoint bound, and complete Motion closure. `_evidence-build3/ledger.log`.
- Baseline clean build was made from git archive of the audited base, with the same installed dependency artifacts. `_evidence-build3/viewer-comparison.json` records exact bytes and artifact SHA-256 values.

All test names below live in `packages/ui/src/blockeditor/canvas/core.test.ts` unless otherwise specified. Each peer fixture checks finite x/y/w/h after every observed transaction.

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
| Cancellation | Required proof: cancellation discards local preview and preserves remote geometry and history |
| Interleaved history, bounded root dispatch | Required proof: interleaved page/canvas history and bounded no-op root dispatch |
| Cross-provider relay undo | Required proof: relay delivery of scalar and raw root undo/redo uses two connected providers exactly once without echo |
| Invalid/fallback docs | Required proof: invalid/fallback docs remain readable without mutation and reject editing |
| Every observed scene complete/finite | Required proof: every observed post-transaction scene has complete finite geometry |
| Decisive D3 example | Decisive D3 example: B wins 40, undo restores seed 0, redo restores 40, losing A and later remote move are preserved |

Additional tests cover ordering/rebalance, history lifecycle and read-only behavior, canvas-level scalars, and clearing both redo paths. `d3-gate.test.ts` contains the initial low-level erase-restore and concurrency preflight.

## Remaining coverage and limitations

No §3 required-proof item is intentionally omitted from the automated headless suite. These are bounded scenarios, not exhaustive concurrency verification. React StrictMode registration/cleanup, permission changes and document replacement now have explicit integration tests. The root adapter's successful/no-op detach/restore is exercised; a deliberately throwing raw manager operation is not injected. Early-published stroke cancellation is not implemented or tested because that publication mode is disabled; pointerup cancellation is covered. Conditional fallback authority, canonical recovery publication, renderer/export recovery integration, and owner-facing UI belong to subsequent work. No fallback authority ruling or hardware acceptance is implied. The full repository suite was not run; the focused suites cover the modified history, relay, saver and viewer-boundary paths.

## Anomaly watch

**No unexplained undo result observed; no absent geometry observed in the executed undo tests.** The recorded historical anomaly remains recorded-not-resolved; this run does not close it. One non-undo ordering test initially asserted hard-coded bounds F..V incorrectly; inspection of existing keysBetween showed it balances two entries to V..l. The assertion was corrected to use actual returned neighbor bounds, and the test passed. This was a test expectation error, not an undo anomaly. The initial viewer fence/byte failure was resolved by the explicit manager-authorized injection seam; all final ledger/fence checks pass.
