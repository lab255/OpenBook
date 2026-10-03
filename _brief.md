# MEET-4 — Block catalogue + prop schemas + MCP surface for `meeting`

You are a Worker agent on the OpenBook team. Work ONLY in this worktree (`/Users/eliot/Workspaces/OpenBook-wt-meet-4`, branch `feat/meet-4-meeting-catalogue`). Do NOT push. Do NOT touch main. Conventional commits (`feat(sdk,mcp): … (MEET-4)`).

## Task
Register a new `meeting` block type in the single-source catalogue so sdk/mcp/server stay drift-free. The UI view lands later (MEET-5) — your job is the type system + MCP/agent surface + docs. Anchors (recon-time hints — trust the code):
- `CATALOGUE_LITERAL` `packages/sdk/src/blockCatalogue.ts:62-113` — entries `{type, category, nature, parent?, props, kitValue?, hint}`. Study how `form` (kit) is declared; mirror its decisions (commit 63969ae3 / FORM-3 is the template epic).
- Prop schemas: `packages/sdk/src/blockPropSchemas.ts` `fields` :51-75 + `CATALOGUE_LITERAL` entry; exports `BLOCK_PROP_SCHEMAS`/`BLOCK_PROP_JSON_SCHEMAS`.
- MCP: `packages/mcp/src/server.ts` picks types up from the catalogue; update `mcp/README.md` prop table (enforced by `mcp/scripts/readme.test.mts` + `blockTypes.test.mts`); regenerate `docs/audits/block-api-coverage.md` via `mcp/scripts/coverage.test.mts` (EXEMPT entries need a written reason — avoid unless truly necessary).
- Server agent validators: `server/src/ai/agentBlockTypes.test.ts`.
- IMPORTANT: ui's `registryCatalogue.test.tsx` requires catalogue kit entries ↔ registered custom blocks to match BOTH directions. The ui view doesn't exist yet. If adding `meeting` as a kit entry breaks that guard, register a minimal placeholder kit registration the way the catalogue/tests structurally require OR structure the entry so the guard passes — pick the smallest honest solution and DOCUMENT it in your report (MEET-5 replaces it). Breaking `pnpm verify` is not acceptable.

## Representation decision (you make it, then document it — MEET-5/6/7 build against it)
Derive prop shapes from what the component will need, favoring existing catalogue idioms (existing tests/conventions win over this brief):
- `status`: 'idle' | 'recording' | 'processing' | 'done'
- audio chunks: ordered list of `{assetId, durationMs, startedAtMs?}` (or parallel arrays if object-arrays aren't idiomatic — check how other blocks store structured props)
- transcript segments: `{startMs, endMs, text}` list — decide props vs child blocks after reading how `form` stores structured kitValue; prefer props unless size/CRDT concerns say otherwise; justify in one paragraph.
- `summary` (string/rich), `startedAt`, `title?`
- manual notes: child blocks (the block should be a container or have a notes container slot — follow the catalogue's `nature`/`parent` idioms, see how form/kit blocks nest).
Write the final representation contract as a short `docs/`-level or in-code doc comment AND in `_report.md` — MEET-5 consumes it verbatim.

## Acceptance
- `list_block_types` returns `meeting` with propsSchema; `add_blocks` / `update_block_props` validate it; invalid props rejected (test).
- All drift guards green: mcp readme/blockTypes/coverage tests, server agentBlockTypes test, ui registryCatalogue guard.
- Coverage matrix regenerated and committed.

## Definition of done
- `pnpm verify` green FOREGROUND here, output in report. (Provisioned; artifact-failure symptom → rebuild viewer/server/mcp bundles.)
- All committed, not pushed. `_report.md`: outcome first, head sha, criterion→test map, THE REPRESENTATION CONTRACT, deviations, open questions. Terse.

## Rules
Never poll external state. Stuck after a real attempt → commit + report. Never delete/weaken existing tests (reviewers check the commit RANGE).
