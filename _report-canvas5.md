# CANVAS-5 — measured local prototype

Status: **D3 PASS; prototype evidence delivered; production/hardware/polish acceptance PARTIAL. Never merge.** No push, PR, public URL, port share, server changes or export/viewer implementation. F1 was ruled live-but-inert by the owner during this task; the separate follow-on owns that work. The supplied specs remain the prototype contract.

Branch: `bb/prototype-canvas-block-with-sync-thr_j2risipqaq`. Implementation SHA is recorded in the delivery section below. Evidence belongs to this branch, not a shipping feature.

**D3: 20/20 new history/relay proofs pass** (19 history tests + actual relay-queue integration test). New simplification test 1/1; existing relay and registry regression tests 18/18. **39/39 total, 5 files.** Required UI typecheck passes. No existing tests modified. Verbose output: [_evidence-canvas5/d3-tests.txt](_evidence-canvas5/d3-tests.txt); [_evidence-canvas5/typecheck.txt](_evidence-canvas5/typecheck.txt).

**Final ink fence median: 17.80 ms, N=12 independent synthetic strokes.** Event→fence median 17.90 ms. **Async second-window join/presence CLS: 0**, Layout Instability API supported, zero shift entries. Both windows had provider peer count 1. Browser errors: 0. Final retained batch was acquired after input-policy fixes, token cleanup, and adding focus/visibility and cadence telemetry; earlier setup batches were replaced, never pooled or used as the headline.

## Live captures and FF verdicts

Open the local [evidence index](_evidence-canvas5/index.html) or the individual files. [Window A recording](_evidence-canvas5/live-window-a.webm) and [Window B recording](_evidence-canvas5/live-window-b.webm) show the same live session in two actual Chromium browser windows. They are independent Playwright recordings, with slightly different recording start times; they are not composited/staged screenshots. All inputs are automation/synthetic, not human strokes. Raw screenshots have the same 900×850 viewport, content and camera for each compared state; only the demonstrated edit/selection changes. The presence dot's native title identifies the peer.

| Capture pair (A/B suffixes) | What it shows | FF verdict |
|---|---|---|
| `01-joined-a/b.png` | Empty common canvas and peer presence after real BroadcastChannel join | **Forgiveness:** peer arrival measured CLS 0. |
| `02-pressure-ink-a/b.png` | 15 locally drawn strokes (3 warmups, first constant-width; 12 retained variable-width) mirrored live | **Immediacy:** 17.80 ms median input-handler→paint-opportunity fence, below ~50 ms target in this workload. |
| `03-keyboard-before-a/b.png` → `04-keyboard-after-a/b.png` | R, Enter creates rectangle; Right + Shift-Down nudges 1 and 10 | **Precision:** exact +1 x, +10 y verified from both replicas, visible coordinate readout. |
| `05-both-editing-a/b.png` | A drew strokes/rectangle; B created arrow, both visible in both windows | **Continuity:** committed remote geometry appears in the existing viewport without camera or layout movement; no motion interpolation claim. |
| `06-concurrent-winner-a/b.png` → `07-winner-undo-a/b.png` → `08-winner-redo-a/b.png` | Same-shape concurrent moves, winning undo, redo | **Forgiveness:** complete rectangle remains on both clients; conditional inverse restores its commit baseline, redo restores the winner. |
| `09-loser-noop-a/b.png` | Losing author's undo leaves winning geometry unchanged and reports no-op | **Forgiveness:** conflict feedback does not silently overwrite the peer. |
| `10-cancel-a/b.png` | Escape cancels unpublished stroke with shared object count unchanged | **Forgiveness:** cancellation discards local preview only. |
| `11-view-only.png` | Separate verification session, same viewport, read-only state | **Restraint:** mutation controls are hidden and tested input routes do not mutate. Not a before/after pair with the live session. |

Live concurrency was forced by an explicitly labeled **transport barrier in the evidence runner only**: queue each window's outgoing `update` BroadcastChannel message across its move commit, then release both through the native channel. Exactly one update was queued per window. No fake peer, state injection, fake scene, replacement transport or staged screenshot. The product provider is unchanged. This makes concurrent writes reproducible rather than relying on two automation calls beating asynchronous delivery. Ordinary drawing, join, presence, undo and redo use unpaused BroadcastChannel delivery.

Live client IDs: A=296249785, B=828405613; winner **B**. Independent local commits: A x=348, B x=388. After convergence: A x=388, y=170, B x=388, y=170. Undo: A x=308, y=150, B x=308, y=150. Redo: A x=388, y=170, B x=388, y=170. Loser undo: A x=388, y=170, B x=388, y=170. Every observed post-transaction scene was checked for finite x/y/w/h; observed transactions A/B=[24, 23]. Unit harness additionally checks complete validated geometry after every transaction on both replicas, including merge and history replay.

## Measurement method and raw samples

Actual registered canvas block on `/editor-lab`, canvas2d direct synchronous preview; React, nested Yjs document, editor chrome and provider are present. Samples collected inside real pointer handlers. First handler statement captures `entry`; retain event timestamp and Q. Paint synchronously, rAF1 records R1, its nested rAF2 records F; EF=F+Q. At most one pending fence; every stroke's **first ink** sample retained. Three warmup strokes discarded, twelve subsequent independent strokes retained; no final-batch outliers removed. The drawing scene grows from 3 to 15 strokes. Cadence median 16.70 ms; raw cadence in JSON. All twelve samples: `isTrusted=false`, `pointerType=pen`, `visibility=visible`, `focused=true`.

This is the CANVAS-2 double-rAF **paint-opportunity approximation**, not proof of physical presentation or physical device-to-display latency. Synthetic pressure is assigned by the harness (.15 through .87). It verifies the code path, not actual Pencil pressure or palm rejection. Chromium only: `148.0.7778.96`. UA: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36`. Two windows 900×850, headed on this Mac; background throttling disabled by launch flags, focus/visibility retained. No Tauri/WebKit or loaded 500-stroke timing acceptance claimed.

| Stroke | Q ms | R1 ms | F ms | EF ms |
|---:|---:|---:|---:|---:|
| 1 | 0.100 | 5.300 | 20.500 | 20.600 |
| 2 | 0.000 | 3.300 | 20.000 | 20.000 |
| 3 | 0.100 | 0.200 | 13.600 | 13.700 |
| 4 | 0.100 | 0.200 | 16.100 | 16.200 |
| 5 | 0.100 | 12.100 | 30.900 | 31.000 |
| 6 | 0.100 | 2.300 | 18.800 | 18.900 |
| 7 | 0.000 | 0.200 | 8.400 | 8.400 |
| 8 | 0.100 | 0.200 | 3.700 | 3.800 |
| 9 | 0.000 | 12.100 | 27.500 | 27.500 |
| 10 | 0.000 | 0.200 | 13.300 | 13.300 |
| 11 | 0.100 | 2.900 | 19.700 | 19.800 |
| 12 | 0.100 | 0.300 | 16.800 | 16.900 |
| Median | 0.100 | 1.300 | 17.800 | 17.900 |

Raw timestamps, cadence, scenes, action times, client IDs, CLS entries: [live-results.json](_evidence-canvas5/live-results.json). Reproduction: `node _evidence-canvas5/live-session.cjs` with the local server running. CLS observer starts before the second navigation, after first-window initial layout settles; it sums entries without recent input. No screenshot is used as latency evidence.

## Implementation and proof mapping

- One page Y.Doc. Registered `canvas` block owns `props.shapes: Y.Map<id,Y.Map>`, scalar geometry/style/defaults, `ord`, points as Y.Array flat pairs, pressure as anchored immutable batches ≤64 pairs. Full shape installed before publication. Pointerup commits only. Unknown JSON props remain preserved by projection.
- `commitCanvasCommand`: unique `op:k` tokens, actual commit-time before-values/tokens, per-key conditional inverse, seed token restoration, redo restricted to applied subset, replaced/deleted shape identity guard. Scalar/inverse transactions retain `local` origin and carry capture-exclusion metadata.
- One chronological journal over the effect-owned root UndoManager; stack events track page/structural operations. Scalar boundaries stop root capture; forward edits clear both redos. Raw dispatch isolates precisely one stack item so a root no-op cannot skip an intervening scalar command. All existing editor undo routes use this wrapper. Known editor UndoManager origins enter the existing outbound relay queue once; remote origins remain excluded.
- Required proofs: both client-ID orders; winning/losing moves; token/value pairing with unequal operation lengths and x-only vs x/y; concurrent inverse token reuse; two edits/two undos/two redos; redo after remote move partial skip; remote erase no-op; append+anchored pressure atomic undo; erase restore after semantic edit; grouped multi-shape command; local cancellation with remote state intact; page/canvas interleave; isolated root no-op; actual relay delivery/echo suppression; invalid/fallback quarantine; read-only guards; erase-vs-edit/append delete-wins. **All passing. No named D3 failures.**
- Creation/append/erase remain structural. Erase restoration recreates CRDT identity: an older semantic command targeting the replaced identity safely skips rather than guessing at equivalence. Tests assert valid restored geometry, not undo through a replaced identity.
- Direct local canvas painting, pressure→width `b*(.5+p)` with constant mouse/keyboard fallback. Touch never inks; variable pressure starts only on a later stroke after observed variation, never restyles a published prefix; pen-active touch events ignored; pointercancel/Escape discard unpublished preview. P/R/A/S/E plus V alias; exact 1/Shift-10 nudges; Delete; Ctrl/Cmd undo/redo; rectangle/arrow keyboard insertion; keyboard pen crosshair. Selection, group move/nudge, corner resize and erase sweep. Every mutation entry checks pageReadOnly.
- Deep snapshot projection resolves pressure anchors to pair offsets. Plain JSON scenes render defensively but remain non-editable; no per-peer rehydration/recovery is attempted. Invalid geometry quarantined without deleting source. Simple SDK catalogue/schema and registration coverage added; no server changes.
- Bounded 64-sample simplification windows, .5-world-unit geometry tolerance and 1/255 pressure tolerance; duplicate-only radial prefilter. Endpoints and pressure extrema retained. No truncation; >100 retained points reports a fidelity budget overrun. New test verifies corners/extrema/endpoints and geometric error. Dedicated runtime final verification against every original sample is not separately implemented.

Ten additional live interaction checks pass with no browser errors: no touch ink, unverified-pressure fallback, pen-active touch suppression, pointercancel/capture loss, visible-bounds stroke resize, Delete/erase undo, Escape ladder, keyboard pen creation, and pageReadOnly pointer/shortcut guards. See [interaction-checks.json](_evidence-canvas5/interaction-checks.json), runner and view-only still. These are synthetic behavior checks, not a screen-reader or hardware certification.

## D4 storage measurement

Nine deliberately varied synthetic boards: 10–500 strokes × 10–1,000 fractional point pairs, random UUIDs, UTF-8 names, anchored pressure, semantic move tokens and retained root undo. These corpus medians are **not representative population medians** and worst case is observed, not an upper bound. No compression or HTTP/presence overhead. Full snapshot includes binary base64 + deep JSON, not the whole page's export projection.

| Bytes per board across this nine-board corpus | Median | Observed max |
|---|---:|---:|
| Raw Yjs before erase | 307,163 | 11,882,876 |
| Base64 before erase | 409,552 | 15,843,836 |
| Complete blockdoc snapshot before erase | 777,842 | 32,457,226 |

Detailed per-board traffic, pre/post erase retained bytes, erase-undo size and journal counts: [storage.json](_evidence-canvas5/storage.json); regenerate with `pnpm --filter @book.dev/ui exec tsx scripts/canvas5-storage.ts`. Packed pointerup batches only; time-flushed/early streaming measurements intentionally omitted because the brief excludes F3 streaming. Corpus points are deliberately unsimplified storage stress inputs. This does not claim simplification savings on representative handwriting or reduced Yjs undo-retention cost.

## Deliberate limitations and deviations

1. Design prototype only; fuller UX is omitted: expansion/pan/zoom, marquee, object-listbox accessibility, numeric properties, style panel, row-height UI, directional arrow endpoint controls, ellipse/text, snapping, arrangement/rebalance UI and animation. Select uses a compact native object chooser; one lower-right resize handle. Single canvas/360px viewport demo. Grouped scalar operations are proved; group bounding-box resize UX is not implemented.
2. Order keys in the prototype are monotonic base62-compatible strings with `(ord,id)` tie sort; not the spec's `keyBetween`/rebalance implementation. No reorder UI or concurrent-rebalance evidence. Follow-on must replace this before production acceptance.
3. Fixed stroke frame is unit basis (`basisW=basisH=w=h=1` initially) with unnormalized local points; transformed visible bounds drive resize. This is equivalent for stored/rendered coordinates but does not store the spec's measured positive capture extents as basis values.
4. Structural/geometry read-only guards and fallback quarantine are implemented; canonical JSON recovery authority/migration fixtures, damaged pressure-anchor diagnostics, durable offline recovery, permission-loss recovery UX and server collaboration are not completed. Malformed/unresolved pressure metadata falls back to constant width without a dedicated fidelity notice. `commitCanvasCommand` rejects missing before-values rather than materializing optional legacy defaults; seeded v1 fields are complete.
5. Toolbar has Undo/Redo controls with current action in title/status, but full visible dynamic action labels, mobile toolbar overflow and screen-reader verification remain. Canvas has no added motion: off-token duration count **0**, opacity-derived color count **0** in added canvas styles. Chrome colors use named design tokens; spacing is minimal inline styling. Drawing ink and selection marks have explicit functional colors. Stillness deliberately retained; no speculative motion pass.
6. No coalesced/predicted sample enhancement or pressure-width toggle. Touch selection only; touch pan/zoom omitted. No physical input, iPad/Pencil, Tauri, WebKit or display-camera measurements. Chromium synthetic pressure and pen/touch checks do not close hardware acceptance. First-ink measurement is small-scene only. Live same-shape concurrency uses the disclosed update barrier; ordinary transport is real BroadcastChannel.
7. No early streaming/time-flushed metadata path; no board population median, sustained pressure workload latency, heap cost or recovery-authority proof. No server/export fidelity work; owner F1 ruling belongs to the follow-on.

These are prototype scope/fidelity findings, not an escalation of D3: the specified undo mechanism survived the tested scenarios. The no-op after replaced identity is intentional conditional semantics, not a missing-geometry failure.

## Run and handoff

From this worktree, one command:

```sh
pnpm dev:prepare && pnpm --filter @book.dev/web dev --hostname 127.0.0.1 --port 3105
```

On this host open `/editor-lab` on the loopback server in two browser windows. Existing localStorage may contain an older lab document without a canvas: use `/canvas` to insert, or clear only `obe-lab-doc` for a fresh seed. P draws; R/A then Enter creates keyboard shapes; S selects; arrows nudge; drag lower-right handle resizes; E erases; Escape cancels/clears/exits; Delete erases; Ctrl/Cmd-Z and Shift-Z use chronological history. `?readonly=1` verifies view-only. The server is bound to loopback; no public share was created. Re-run the evidence runner for a deterministic concurrent barrier and recorded assertions.

Worker wind-down steps 1+3: this report is the durable board handoff. Manager should persist **D3 PASS / prototype delivered / broader polish and hardware PARTIAL**, branch, implementation/delivery SHA and deviations. No roster lease or Claim ID was supplied; none is known to release. Ready for manager review and manager-owned DO-NOT-MERGE draft handling; worker did not push/open a PR. Local dev server remains on 3105 for review.

Report and evidence copies: worktree `_report-canvas5.md`, `_evidence-canvas5/`; `/Users/eliot/.bb/thread-storage/canvas-epic/_report-canvas5.md` and `/Users/eliot/.bb/thread-storage/canvas-epic/_evidence-canvas5/`.

## Delivery commit and capture anomaly

Implementation commit: `5f0455ce7b46457cadd7607fa7eb84aa68347cbb`. The subsequent docs commit contains this report and evidence.

One preflight recapture failed at the assertion that the shared rectangle still existed after winning undo (`live-session.cjs:58`, undefined shape lookup). A commit hook was stashing/reverting files while a rebuild/capture pipeline was also running. That overlap is a possible confound, **not an established cause**: the failure did not retain a history trace sufficient to identify its mechanism. The failure log is retained as [capture-preflight-failure.txt](_evidence-canvas5/capture-preflight-failure.txt). After completing the source commit and hooks, the isolated live rerun passed every assertion on the committed build with no browser errors; that is the final evidence batch. Automated D3 remains 20/20. Treat the transient as an unresolved preflight anomaly, not evidence of production readiness or a demonstrated infeasibility of the undo mechanism.
