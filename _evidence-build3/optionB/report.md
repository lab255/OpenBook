## Owner-ruled option B — pressure shares the points lifecycle

Authority: owner ruled B on 2026-11-17, relayed by manager thr_yu4up34sb7; `_brief-build3-optionB.md` and all eight `_standing-rules.md` apply. The follow-up schema ruling makes arity per shape: binary derives it from creation-fixed pressureMode; JSON projects an explicit per-shape pointArity, default 2. No canvas-level arity field or migration (nothing shipped).

**Verified starting position, measured BEFORE rework at held f70a953d8d6b201c5193839975264507d5f608b8:** coordinate **727 B** (post-seam: pre-seam 567 + BUILD-3 history seam 160); **ledger 7/7 PASS**; **viewer 1,933,102 B**. Manager accepted this sequencing result before implementation. The held branch and `/Users/eliot/.bb/thread-storage/canvas-build/build3-round3-stop/` remain the before-state reference, including all four failed append captures. Neither reference was deleted.

### Amendment and mechanism

Variable strokes now append x,y,q triplets to one Y.Array (q integer 0–255); constant strokes retain x,y pairs. The 64-point transaction bound remains. There is no pressure metadata map, relative-position resolver, or pressure restoration repair. A point and its q share insertion/deletion/redo identity; later remote points cannot receive an earlier batch's pressure through a stale tombstone anchor. The former tombstone composition now asserts the exact live triplets and absence of the metadata map, plus expected widths on both peers and reload, instead of relying on a resolver predicate.

Scalar preimages, token eligibility, page deletion capture, and scoped scalar repair remain. Capture refreshes on deletion (including redo), so later restoration uses the latest scalar baseline. History hooks diagnose instead of throwing; test observers collect errors for assertions outside Yjs callbacks. Missing required scalars remain repaired or diagnosed by shape/key, never drawn from defaults. Invalid point arity, non-finite coordinates or out-of-range/non-integer q quarantine and diagnose the shape. A mismatched projected marker does not suppress other readable shapes; the existing whole-scene editable lock remains the separately recorded UI-card decision.

The app wrapper synchronously registers a generic props-projection hook so actual encodeSnapshot/docToJSON JSON includes per-shape pointArity. The shared model contains no canvas imports/types; with no registered codec its projection behavior is unchanged. Binary snapshots store no added arity field. A snapshot test proves projection is non-mutating. Future decimation must carry each retained point's q and retain pressure extrema (§7), documented in the schema module; no decimator is shipped here.

### Acceptance and deletion inertness

- **128/128 focused tests PASS**, plus **7/7 ledger tests PASS** (135 total).
- **58/58 erase cases PASS before and after**; **zero changed outcomes**, case-by-case diff in `erase-matrix-diff.json`. Same source enumeration: 32 serial/between-leg, 24 concurrent shape/page, 2 simultaneous peer erase/undo/interleaved redo/undo; every matrix convergence includes reload. Held Vitest truncated object-interpolated names; the diff retains their index and raw name and pairs them with the now-fully-emitted case name.
- All **four held append failures now pass FULL FIDELITY**, both client-ID orders and remote append timings, first and second undo/redo, per-update delivery, A/B/reload. No degraded fallback is accepted.
- Two mixed-canvas cases (both ID orders) exercise pair and triplet strokes together through two undos/two redos and reload at each leg. The projected mismatch quarantines the named shape while the other remains readable. Default-2 constant JSON without the marker reads byte-for-byte identically to explicit-2 JSON.
- **Superseded — initial typecheck and full UI build FAILED on TS2352, exit 2** (see committed `typecheck.txt` / `app-build.txt` in `_evidence-build3/optionB/`). Fixed in **cf5ac16c**, with the verified-exit build recorded in the CI build follow-up section of `_report-build3.md` and `_evidence-build3/optionB-buildfix/build.txt`. Lint passed with 28 existing warnings, zero errors. Generic snapshot marker/non-mutation test also passes.
- Final option-B ledger evidence is `_evidence-build3/optionB/focused.txt`: **seeded=1933140, 7/7 PASS**, coordinate **765 B**. `optionB/ledger.txt` is explicitly relabeled as the earlier held-size artifact run (seeded=1933102), not final B evidence.
- Anomaly watch: no new undo anomaly. The initial port run exposed one ordinary fixture mismatch: variable JSON produced by raw toJSON lacked the now-required marker; the fallback test was updated to exercise the actual projection helper. All history compositions passed on that run and the final run.

### Document bytes — NOT viewer-code bytes

Same real production createShape/appendPoints path at held f70a953d and B, Yjs 13.6.31, client 101, integer coordinates matching the scratch workloads, 64-point batches and integer q. Actual full schema defaults, block nesting and UUID metadata keys are included. Scratch probe `/tmp/claude-501/b-bytes/measure.mjs` omitted those defaults/nesting and used short batch IDs plus JSON-string anchors; its 16–26% estimate is not substituted for these measurements. All real-schema rows are smaller. No above-baseline stop threshold fired.

Raw = Y.encodeStateAsUpdate bytes. Combined = base64 update + UTF-8 shape projection bytes, excluding the outer snapshot JSON envelope. The 500×100 row matches the scratch retained-point budget P'=100; it measures retained data, not an implemented decimation algorithm. Fractional-coordinate stress rows (100×50/250/1000/2000, 16/64-point batches) are separately preserved in document-before/after.jsonl and also all shrink.

| Shapes × points | Held raw B | Option B raw B | Raw delta | Combined B, held → B |
|---|---:|---:|---:|---:|
| 1×50 | 1,085 | 942 | -13.2% | 2,395 → 2,179 |
| 1×100 | 1,627 | 1,353 | -16.8% | 3,653 → 3,241 |
| 1×1000 | 11,211 | 9,103 | -18.8% | 27,519 → 24,373 |
| 100×50 | 98,855 | 84,317 | -14.7% | 220,154 → 198,370 |
| 500×50 | 506,851 | 432,717 | -14.6% | 1,118,150 → 1,007,302 |
| 500×1000 | 5,618,207 | 4,515,711 | -19.6% | 13,745,290 → 12,106,294 |
| 1×200 | 2,744 | 2,208 | -19.5% | 6,323 → 5,521 |
| 1×2000 | 21,907 | 17,703 | -19.2% | 55,563 → 49,265 |
| 500×200 | 1,347,820 | 1,067,603 | -20.8% | 3,097,442 → 2,680,818 |
| 500×100 | 782,395 | 639,435 | -18.3% | 1,752,542 → 1,539,926 |

### Viewer-code coordinate — independent budget axis

| Build | Viewer B | nonMotionGrowthBytes | Ledger |
|---|---:|---:|---|
| Pre-seam main 6b6106fa | 1,932,942 | 567 | historical baseline |
| Held f70a953d (fresh clean build) | 1,933,102 | 727 | 7/7 PASS |
| Option B (fresh clean build) | 1,933,140 | 765 | 7/7 PASS |

The projection seam adds **38 B over held**, total history+projection seam **198 B over pre-seam main**. Under both the current +300-over-727 rule and the original +300-over-567 rule; coordinate remains below 4,096. Canvas modules remain outside the viewer graph. Held SHA-256 `5c78d33fbe54ad95397b47db03887877670ffe9a0e5104b3f77b3df84b838dc7`; B SHA-256 `44d87567e3040a6788d4efdba2daa06752ab94c116379f43c823d5f2178110bf`. Artifact path, mtime, byte length and build mode are in viewer-after.json. Future F1 export slice is not measured or budgeted by these document savings.

### Performance — milliseconds, median / worst of five trials

Same original 500×50 and 500×1,000 constant-stroke workloads/method, sequential benchmark run with no rendering/network, per-command resolver retained:

| Workload | Move median / worst | Undo median / worst | Redo median / worst |
|---|---:|---:|---:|
| 500×50; selected 1 | 0.10 / 0.62 | 0.05 / 0.19 | 0.28 / 0.54 |
| 500×1000; selected 1 | 0.09 / 0.09 | 0.05 / 0.05 | 0.22 / 0.27 |
| 500×50; selected 500 | 7.08 / 8.05 | 5.72 / 7.40 | 8.80 / 11.72 |
| 500×1000; selected 500 | 14.05 / 16.77 | 13.84 / 15.71 | 12.20 / 15.63 |

Keep the unfixed worst case visible: before fix round 1, dense 500×1,000 full-selection undo was **12,621.09 ms median / 13,609.72 ms worst**, now **13.84 / 15.71 ms** on the same workload/method. Original before single move medians were 2.68/14.63 ms, full-selection move 836.86/6,132.49 ms (50/1,000); those historical raw samples/tables remain in the earlier PR section and report. This B table is a new run, not a replacement of the earlier measured baseline.

Additional B triplet workloads (same point counts, validation includes q):

| Workload | Move median / worst | Undo median / worst | Redo median / worst |
|---|---:|---:|---:|
| 500×50; selected 1 | 0.15 / 0.57 | 0.06 / 0.19 | 0.34 / 1.61 |
| 500×1000; selected 1 | 0.21 / 0.28 | 0.08 / 0.27 | 0.69 / 1.17 |
| 500×50; selected 500 | 12.96 / 24.08 | 9.35 / 14.69 | 11.68 / 15.00 |
| 500×1000; selected 500 | 34.52 / 45.34 | 27.89 / 42.57 | 30.02 / 37.64 |

### CI regression follow-up

The historical hide-column CI failure at 9adc3567 remains unexplained; it is not labeled flaky. Its control path calls db.updateView, not canvas history dispatch. The prior held local exact test passed. This B round includes the necessary shared generic projection seam, so a repeated CI failure must not be described as occurring on an exclusively canvas-module delta. CI on the pushed head remains the arbiter; any repeated hide-column failure must be captured and reported. No database code or test behavior was changed.
Local B-head check after a full UI rebuild: exact hide-column Playwright test **1/1 PASS**, single-process Chromium, one worker, zero retries (2.1 s test / 24.7 s run). Watchpack emitted local EMFILE warnings; the assertion passed. Log: `_evidence-build3/optionB/hide-column.txt`.

