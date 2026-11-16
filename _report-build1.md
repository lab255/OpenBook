# BUILD-1 — guards and viewer registration fence

Audited at: 2c45cb1ce767ff0b19ab16a21e33e2e4bad7688e

Implemented on `bb/execute-build-1-canvas-brief-thr_k2hsx22ruq` under Amendments 1 and 2 and the manager ruling permitting module-identity accounting movement when ruled coordinates remain unchanged. PR: https://github.com/lab255/OpenBook/pull/447 (against main). Implementation commit `a4f9262064bdd71b43ab89c10021dace33b3ec3b` was pushed and verified with `git ls-remote`. Plain `git push` reported no upstream; explicit `git push origin HEAD:refs/heads/bb/execute-build-1-canvas-brief-thr_k2hsx22ruq` succeeded. The clean committed build reproduced the identical IIFE hash and ledger 7/7 PASS; see `committed-build.log` and `committed-ledger.log`.

## Changes prepared

- Existing endpoint authorization widened 571 → 4,096 B, with 4,096 accepted / 4,097 rejected by the boundary fixtures; −506/−507 unchanged.
- JSON rationale and ledger documentation record 3,159 B measured coordinate at `59c49f80e17deedc67f6cf8d5f16835bdd5e0534`, distinct from 2,981 B raw slice net cost and 4,096 B authorization. They retain the superseded CARD-10 571 B provenance (+100 FF-7a / PR #435 CI +471 palette polish), R1 owner 2026-11-12 via PM² relay, and deliberate bounded allowance 937 B. Further widening requires a new owner decision.
- Extracted existing registration implementation unchanged to `reactiveCore.tsx`. App `reactiveBlocks.tsx` wraps that registration; viewer imports the core directly. Added an assertion in the existing graph test excluding the app wrapper and `src/blockeditor/canvas/` modules from the viewer graph. No canvas code or insertion-metadata behavior changes.
- All independent ceilings, Motion authorization and exact Motion byte count unchanged.

## Results

Clean production whole-IIFE UTF-8 size before and after: **1,932,942 B**. Both SHA-256 hashes: `08e3a52fc3248105a6cea4c4399995dcc1a0f2b7f200b78300e658508f772ffe`. Ledger **7/7 PASS before and after**. Motion rendered bytes **211,511 unchanged**. Registry catalogue, slash-menu and export-parity tests **16/16 PASS**; UI typecheck and changed-file ESLint PASS.

The emitted graph changes the registration module ID from `src/blockeditor/reactiveBlocks.tsx` to `src/blockeditor/reactiveCore.tsx`, and its pre-final-minification rendered bytes change **3,283 → 3,281 B**. Temporary debug dumps of `chunk.modules[id].code` prove the sole difference is Rolldown's `//#region src/blockeditor/reactiveBlocks.tsx` banner becoming `//#region src/blockeditor/reactiveCore.tsx`: the shorter filename removes exactly two bytes. The rendered code is otherwise byte-identical. The only other graph difference is the viewer entry import edge. The debug patch has been removed from `motionGraph.mjs` before commit. The manager explicitly permitted this module-identity accounting change because no ruled coordinate moved.

No unexpected guard fired and no test failed. The temporary stop was resolved by the manager ruling and the rendered-code diff; no stale-vendor issue occurred. The old source-level test conflict was explicitly resolved by Amendment 1.

Evidence directory: `/Users/eliot/.bb/thread-storage/canvas-build/build1-evidence/` contains before/after build and ledger logs, retained viewer artifacts, before/after graphs, parity/typecheck/lint logs, and `measurement.json` with paths, mtimes, hashes, sizes and build modes. Final tested artifact: `/Users/eliot/.bb/plugins/environment-git-worktree/host-data/worktrees/thr_k2hsx22ruq-1/OpenBook/packages/ui/src/export/vendor/openbook-viewer.js`, mtime `2026-11-16T15:07:03.513Z`, 1,932,942 B, production mode.

## Commands

Node 24.14.1; pnpm 10.28.2. Fresh worktree had no UI dist or Next outputs. Provisioned with `CI=true pnpm install` and `pnpm --filter @book.dev/sdk build`. Install succeeded; reported missing unbuilt server/MCP bins and inability to write shared git config for Husky setup. No full-suite run or hook bypass was attempted.

Before changing source, and again after changes (including final documentation updates):

```sh
rm -f packages/ui/src/export/vendor/openbook-viewer.js packages/ui/src/export/vendor/motion-graph.json
NODE_ENV=production pnpm --filter @book.dev/ui run build:viewer
pnpm --filter @book.dev/ui exec vitest run scripts/motionFeatureLedger.test.ts
```

Additional checks:

```sh
pnpm --filter @book.dev/ui exec vitest run src/blockeditor/registryCatalogue.test.tsx src/blockeditor/__tests__/SlashMenu.test.tsx scripts/exportParityFixtures.test.ts
pnpm --filter @book.dev/ui typecheck
pnpm --filter @book.dev/ui exec eslint scripts/motionFeatureLedger.test.ts src/blockeditor/reactiveCore.tsx src/blockeditor/reactiveBlocks.tsx src/viewer/index.tsx
git diff --check
```

Rendered-code audit: clean before/after production builds used the same deletion and `NODE_ENV=production` build commands above, with a temporary generateBundle dump only. `before-rendered.js` and `after-rendered.js` retain the exact emitted code; `debug-before-build.log` and `debug-after-build.log` retain the build output. The production source extraction is byte-identical to the original registration implementation.
