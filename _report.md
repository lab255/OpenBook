PASS — MEET-1 audio asset support implemented. `VITEST_MAX_WORKERS=1 pnpm verify` passed in the foreground outside the sandbox (exit 0); full output below. No push.

Verified implementation HEAD: `a535c2f3d6f2daf422d8575e5756a23af30869a8`. Report commit is the final branch HEAD (reported in the handoff).

| Criterion | Tests | Commit |
| --- | --- | --- |
| 1. Five audio MIME types stored/served | `assets.test.ts`: “round-trips %s through binary and base64-JSON uploads…” (all five); `backups.test.ts`: “preserves audio MIME types and bytes through backup restore” | `451ea1d5` |
| 2. Binary/base64 uploads, routes, ETag/304 and private caching | `assets.test.ts`: five audio round-trip cases, both upload and GET formats | `451ea1d5` |
| 3. 10 MiB cap and chunk-size comment | `assets.test.ts`: “rejects over-cap audio with 413…” (binary + JSON); comment beside `ASSET_MAX_BYTES` | `451ea1d5` |
| 4. GC retains audio ID in block props | `assetGc.test.ts`: “keeps audio referenced only by block props until the reference is removed” (zero ref-table edges; removal permits GC) | `451ea1d5` |
| 5. Attachment/nosniff and unchanged access gates | Audio round-trip header assertions; “applies the same read and write gates to audio…”; existing image/HTML security suites | `451ea1d5` |

Deltas/deviations:
- Added shared `ASSET_MIMES` union alongside the audio allowlist; both restore paths use it to preserve audio MIME types.
- Corrected an initial new restore assertion to match `getAsset`’s actual return shape (MIME/bytes, no ID).
- First full verify exposed an existing OIDC fixture PAT expired since September 8, 2026 (401 vs expected 302). `a535c2f3` bases its expiry on the PAT wall clock; all assertions retained. Isolated regression passed after correction.
- Sandboxed mirror integration failed with filesystem-watcher `EMFILE`; all three tests passed unchanged outside the sandbox. Stopped the known-failing initial verify (exit 130) and ran the full foreground command outside the sandbox.
- A full unsandboxed attempt hit the unchanged SDK million-case money test’s 5s timeout under host load; all 546 SDK tests passed with `VITEST_MAX_WORKERS=1`. Final verification uses that setting, preserving all assertions and timeouts.
- Another attempt exited during UI stylelint checks while host storage fell to 116 MiB free. Stylelint passed unchanged in isolation; free space recovered before the final run.
- Git emitted a sandbox warning about `packed-refs.lock`; commits succeeded and were verified.

Validation: SDK 546 passed; UI 2,319 passed; desktop 7 passed; server 1,336 passed, 6 existing skips across 97 files; MCP checks and server/MCP end-to-end suites passed.

Open questions: none.

<details>
<summary>Full foreground pnpm verify output (exit 0)</summary>

```text

> open-book@0.0.0-workspace verify /Users/eliot/Workspaces/OpenBook-wt-meet-1
> pnpm run test:eslint-rules && pnpm run build:libs && pnpm run check:gen && pnpm run typecheck && pnpm run lint && pnpm run test && pnpm run test:e2e


> open-book@0.0.0-workspace test:eslint-rules /Users/eliot/Workspaces/OpenBook-wt-meet-1
> node --test eslint-rules/*.test.mjs

✔ allows spacing-scale utilities and non-spacing arbitrary values (56.527041ms)
✔ flags arbitrary padding, margin, and gap values in className (29.122834ms)
✔ checks nested, template, and conventionally named hoisted class strings (10.808791ms)
✔ allows paint-only hover changes and non-hover geometry (49.224459ms)
✔ flags every guarded hover-geometry utility family (30.007542ms)
✔ flags display swaps in either class ordering and nested class strings (6.503291ms)
ℹ tests 6
ℹ suites 0
ℹ pass 6
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 678.04025

> open-book@0.0.0-workspace build:libs /Users/eliot/Workspaces/OpenBook-wt-meet-1
> pnpm --filter @book.dev/sdk run build && pnpm --filter @book.dev/ui run build && pnpm --filter @book.dev/mcp run build && pnpm --filter @book.dev/server run build


> @book.dev/sdk@3.17.0 build /Users/eliot/Workspaces/OpenBook-wt-meet-1/packages/sdk
> tsc -p tsconfig.build.json


> @book.dev/ui@3.17.0 build /Users/eliot/Workspaces/OpenBook-wt-meet-1/packages/ui
> pnpm run gen:bundled-plugins && pnpm run build:viewer && vite build && tsc


> @book.dev/ui@3.17.0 gen:bundled-plugins /Users/eliot/Workspaces/OpenBook-wt-meet-1/packages/ui
> node --import tsx scripts/bundlePlugins.ts

[bundlePlugins] OPENBOOK_REGISTRY_PRIVATE_KEY is unset — signing with the committed TEST-ONLY key (scripts/test-registry-key.json). Fine for dev/test; production builds must set the secret (docs/plugin-signing.md).
wrote src/plugins/bundled.gen.ts (1 plugin(s), signed by OpenBook Test Registry [test])
wrote src/export/ledgerFolds.gen (2 fold module(s))

> @book.dev/ui@3.17.0 build:viewer /Users/eliot/Workspaces/OpenBook-wt-meet-1/packages/ui
> vite build --config vite.viewer.config.js

vite v8.0.14 building client environment for production...
[2K
transforming...✓ 2076 modules transformed.
rendering chunks...
computing gzip size...
src/export/vendor/openbook-viewer.js  1,727.92 kB │ gzip: 486.47 kB

✓ built in 2.15s
vite v8.0.14 building client environment for production...
[2K
transforming...✓ 356 modules transformed.
rendering chunks...
computing gzip size...
dist/style.css                         190.24 kB │ gzip:  31.11 kB
dist/rolldown-runtime-Dy4uBu1J.js        0.24 kB │ gzip:   0.21 kB
dist/emoji-Bmft6RPl.js                   0.30 kB │ gzip:   0.23 kB
dist/databaseMapLeaflet-8LYcHcR6.js      2.70 kB │ gzip:   1.37 kB
dist/pageCover-DG_o7L9m.js               3.06 kB │ gzip:   1.27 kB
dist/chartData-DQo78QVa.js               3.41 kB │ gzip:   1.44 kB
dist/exportSite-BhXgGHTe.js              5.19 kB │ gzip:   2.14 kB
dist/toPdf-DYGZU1B5.js                   5.94 kB │ gzip:   2.52 kB
dist/themes-CDtwgOr5.js                  9.86 kB │ gzip:   2.99 kB
dist/quickjsVm-BLKBOeOk.js              10.75 kB │ gzip:   3.58 kB
dist/EmojiGrid-wB896zFy.js              10.84 kB │ gzip:   4.36 kB
dist/exportBlocks-CNF_rL3d.js           36.70 kB │ gzip:  10.00 kB
dist/lucideIcons-DzkS5mW9.js            83.10 kB │ gzip:  25.98 kB
dist/pageIcon-Dn-g2w6N.js              355.97 kB │ gzip: 110.27 kB
dist/scope-DjPmYdi5.js                 786.80 kB │ gzip: 329.50 kB
dist/openbook-viewer-DleN9qK4.js     1,738.48 kB │ gzip: 487.23 kB
dist/index.js                        2,962.77 kB │ gzip: 813.80 kB

[INEFFECTIVE_DYNAMIC_IMPORT] src/plugins/index.ts is dynamically imported by src/screens/BlockPageDocument.tsx but also statically imported by src/blockeditor/MissingPluginBlock.tsx, src/components/ExtensionsSettings.tsx, src/components/PluginBoot.tsx, src/components/useAppCommands.ts, src/screens/BlockPageDocument.tsx, dynamic import will not move module into another chunk.

[INEFFECTIVE_DYNAMIC_IMPORT] src/export/toHtml.ts is dynamically imported by src/screens/BlockPageDocument.tsx but also statically imported by src/index.ts, dynamic import will not move module into another chunk.

[PLUGIN_TIMINGS] Your build spent significant time in plugins. Here is a breakdown:
  - vite:asset (45%)
  - vite:worker (19%)
  - vite:css (13%)
  - vite:css-post (7%)
See https://rolldown.rs/options/checks#plugintimings for more details.

✓ built in 3.87s

> @book.dev/mcp@3.17.0 build /Users/eliot/Workspaces/OpenBook-wt-meet-1/packages/mcp
> tsup

CLI Building entry: {"bin":"src/bin.ts","index":"src/index.ts"}
CLI Using tsconfig: tsconfig.json
CLI tsup v8.5.1
CLI Using tsup config: /Users/eliot/Workspaces/OpenBook-wt-meet-1/packages/mcp/tsup.config.ts
CLI Target: node18
CLI Cleaning output folder
ESM Build start
ESM dist/bin.js                2.40 KB
ESM dist/index.js              136.00 B
ESM dist/chunk-N6662UMY.js     98.60 KB
ESM dist/bin.js.map            6.65 KB
ESM dist/index.js.map          71.00 B
ESM dist/chunk-N6662UMY.js.map 181.29 KB
ESM ⚡️ Build success in 90ms
DTS Build start
DTS ⚡️ Build success in 5150ms
DTS dist/index.d.ts 1.84 KB

> @book.dev/server@3.17.0 build /Users/eliot/Workspaces/OpenBook-wt-meet-1/packages/server
> tsup

CLI Building entry: {"bin":"src/bin.ts","index":"src/index.ts","browser":"src/browser.ts"}
CLI Using tsconfig: tsconfig.json
CLI tsup v8.5.1
CLI Using tsup config: /Users/eliot/Workspaces/OpenBook-wt-meet-1/packages/server/tsup.config.ts
CLI Target: node18
CLI Cleaning output folder
ESM Build start
ESM dist/bin.js                215.00 B
ESM dist/browser.js            30.24 KB
ESM dist/index.js              552.00 B
ESM dist/chunk-Z5QDSVHR.js     415.58 KB
ESM dist/chunk-V6MBCKVR.js     422.16 KB
ESM dist/bin.js.map            556.00 B
ESM dist/browser.js.map        61.42 KB
ESM dist/index.js.map          71.00 B
ESM dist/chunk-V6MBCKVR.js.map 787.04 KB
ESM dist/chunk-Z5QDSVHR.js.map 1005.77 KB
ESM ⚡️ Build success in 236ms
DTS Build start
DTS ⚡️ Build success in 12816ms
DTS dist/index.d.ts        68.49 KB
DTS dist/browser.d.ts      13.43 KB
DTS dist/hub-CUJHMMTq.d.ts 136.66 KB

> open-book@0.0.0-workspace check:gen /Users/eliot/Workspaces/OpenBook-wt-meet-1
> pnpm --filter @book.dev/ui run check:gen


> @book.dev/ui@3.17.0 check:gen /Users/eliot/Workspaces/OpenBook-wt-meet-1/packages/ui
> pnpm run gen:bundled-plugins && (git diff --exit-code -- src/plugins/bundled.gen.ts src/export/ledgerFolds.gen || (echo 'Committed .gen mirror is STALE: run pnpm --filter @book.dev/ui run gen:bundled-plugins and commit the result.' >&2 && exit 1))


> @book.dev/ui@3.17.0 gen:bundled-plugins /Users/eliot/Workspaces/OpenBook-wt-meet-1/packages/ui
> node --import tsx scripts/bundlePlugins.ts

[bundlePlugins] OPENBOOK_REGISTRY_PRIVATE_KEY is unset — signing with the committed TEST-ONLY key (scripts/test-registry-key.json). Fine for dev/test; production builds must set the secret (docs/plugin-signing.md).
wrote src/plugins/bundled.gen.ts (1 plugin(s), signed by OpenBook Test Registry [test])
wrote src/export/ledgerFolds.gen (2 fold module(s))

> open-book@0.0.0-workspace typecheck /Users/eliot/Workspaces/OpenBook-wt-meet-1
> pnpm -r --if-present run typecheck

Scope: 6 of 7 workspace projects
packages/sdk typecheck$ tsc -p tsconfig.json --noEmit
packages/sdk typecheck: Done
packages/ui typecheck$ tsc --noEmit
packages/ui typecheck: Done
packages/app typecheck$ tsc --noEmit
packages/app typecheck: Done
packages/mcp typecheck$ tsc --noEmit
packages/server typecheck$ tsc --noEmit
packages/mcp typecheck: Done
packages/server typecheck: Done
packages/web typecheck$ tsc --noEmit
packages/web typecheck: Done

> open-book@0.0.0-workspace lint /Users/eliot/Workspaces/OpenBook-wt-meet-1
> pnpm -r run lint

Scope: 6 of 7 workspace projects
packages/sdk lint$ eslint .
packages/sdk lint: Done
packages/ui lint$ eslint . && pnpm run lint:css && pnpm run test:stylelint
packages/ui lint: > @book.dev/ui@3.17.0 lint:css /Users/eliot/Workspaces/OpenBook-wt-meet-1/packages/ui
packages/ui lint: > stylelint src/index.css
packages/ui lint: > @book.dev/ui@3.17.0 test:stylelint /Users/eliot/Workspaces/OpenBook-wt-meet-1/packages/ui
packages/ui lint: > node scripts/assert-spacing-stylelint.mjs
packages/ui lint: SPC-2 stylelint controls passed (2 positive, 4 negative)
packages/ui lint: Done
packages/app lint$ eslint .
packages/app lint: Done
packages/mcp lint$ eslint .
packages/server lint$ eslint .
packages/mcp lint: Done
packages/server lint: Done
packages/web lint$ eslint .
packages/web lint: Done

> open-book@0.0.0-workspace test /Users/eliot/Workspaces/OpenBook-wt-meet-1
> pnpm -r --if-present run test

Scope: 6 of 7 workspace projects
packages/sdk test$ vitest run
packages/sdk test:  RUN  v4.1.7 /Users/eliot/Workspaces/OpenBook-wt-meet-1/packages/sdk
packages/sdk test:  Test Files  32 passed (32)
packages/sdk test:       Tests  546 passed (546)
packages/sdk test:    Start at  23:21:30
packages/sdk test:    Duration  22.72s (transform 2.10s, setup 0ms, import 4.26s, tests 6.54s, environment 8ms)
packages/sdk test: Done
packages/ui test$ vitest run
packages/ui test:  RUN  v4.1.7 /Users/eliot/Workspaces/OpenBook-wt-meet-1/packages/ui
packages/ui test:  Test Files  244 passed (244)
packages/ui test:       Tests  2319 passed (2319)
packages/ui test:    Start at  23:21:54
packages/ui test:    Duration  719.48s (transform 20.81s, setup 0ms, import 251.50s, tests 212.69s, environment 158.24s)
packages/ui test: Done
packages/app test$ vitest run
packages/app test:  RUN  v4.1.7 /Users/eliot/Workspaces/OpenBook-wt-meet-1/packages/app
packages/app test:  Test Files  2 passed (2)
packages/app test:       Tests  7 passed (7)
packages/app test:    Start at  23:33:54
packages/app test:    Duration  10.63s (transform 6.69s, setup 0ms, import 8.76s, tests 153ms, environment 1.04s)
packages/app test: Done
packages/server test$ vitest run
packages/mcp test$ node --import tsx scripts/listed.test.mts && tsx scripts/pages.test.mts && tsx scripts/suggestions.test.mts && tsx scripts/databases.test.mts && tsx scripts/assets.test.mts && tsx scripts/blocks.test.mts && tsx scripts/tables.test.mts && tsx scripts/forms.test.mts && tsx scripts/blockTypes.test.mts && tsx scripts/readme.test.mts && tsx scripts/endpoint.test.mts && tsx scripts/coverage.test.mts
packages/server test:  RUN  v4.1.7 /Users/eliot/Workspaces/OpenBook-wt-meet-1/packages/server
packages/mcp test: ✅ ALL 3 MCP LISTED CONTRACT CHECKS PASSED
packages/mcp test:   ✓ set_page_appearance applies in direct mode
packages/mcp test:   ✓ valid gradient id resolves to curated css
packages/mcp test:   ✓ read_page reflects persisted appearance
packages/mcp test:   ✓ move_page reparents a page
packages/mcp test:   ✓ list_pages exposes the new parent and order
packages/mcp test:   ✓ get/set page properties round-trip
packages/mcp test:   ✓ unknown page returns a typed safe error
packages/mcp test:   ✓ moving into an own subtree is refused
packages/mcp test:   ✓ invalid appearance enum is refused without path leakage
packages/mcp test:   ✓ arbitrary gradient css is refused
packages/mcp test:   ✓ http image cover is refused
packages/mcp test:   ✓ javascript image cover is refused
packages/mcp test:   ✓ https image cover is accepted
packages/mcp test:   ✓ OpenBook asset image cover is accepted
packages/mcp test:   ✓ computed/unknown property writes are typed refusals
packages/mcp test:   ✓ read-only instance refuses writes with a typed error
packages/mcp test:   ✓ read-only refusal leaves properties unchanged
packages/mcp test: ✅ ALL 17 API-10 PAGE TOOL CHECKS PASSED
packages/mcp test: OpenBook server up at http://127.0.0.1:4406
packages/mcp test: Resolved suggest (instance suggest, page inherit) — writes create suggestions
packages/mcp test:   ✓ upload_asset refuses suggest/read-only policy (bytes never become a suggestion)
packages/mcp test:   ✓ update_block returns a "Suggested for review" result
packages/mcp test:   ✓ update_block recorded exactly one suggestion
packages/mcp test:   ✓ suggestion kind maps update_block → replace-text
packages/mcp test:   ✓ suggestion is authored by the MCP client (authorKind ai)
packages/mcp test:   ✓ suggestion targets the block
packages/mcp test:   ✓ suggestion payload mirrors the agent (applyKind + before merge base)
packages/mcp test:   ✓ the page text was NOT mutated (still original)
packages/mcp test:   ✓ set_db_cell returns a "Suggested for review" result
packages/mcp test:   ✓ set_db_cell recorded a set-cell suggestion on the host page
packages/mcp test:   ✓ set-cell suggestion targets the db/row/property
packages/mcp test:   ✓ the database cell was NOT mutated
packages/mcp test:   ✓ all six API-9 database writes suggest under suggest policy
packages/mcp test:   ✓ create_database creates its host page immediately under suggest policy
packages/mcp test:   ✓ whitespace property name is refused under suggest policy
packages/mcp test:   ✓ describe_database remains a read under suggest policy
packages/mcp test:   ✓ suggested update/delete row did not mutate
packages/mcp test:   ✓ API-10 page writes suggest and get_page_properties remains a read
packages/mcp test:   ✓ suggested API-10 writes do not mutate
packages/mcp test:   ✓ create_page applies immediately (page exists)
packages/mcp test:   ✓ create_page recorded no suggestion
packages/mcp test: Resolved direct (instance policy = direct) — writes mutate directly
packages/mcp test:   ✓ all six API-9 database writes apply under direct policy
packages/mcp test:   ✓ whitespace property name is refused under direct policy
packages/mcp test:   ✓ direct delete_row moved the row to trash
packages/mcp test:   ✓ all four API-10 page tools succeed under direct policy
packages/mcp test:   ✓ upload_asset applies under direct policy
packages/mcp test:   ✓ update_block confirms a direct write
packages/mcp test:   ✓ the page text WAS mutated under instance=direct
packages/mcp test:   ✓ direct write recorded NO new suggestion
packages/mcp test: Page override (suggest) beats instance (direct)
packages/mcp test:   ✓ page suggest override → a suggestion despite instance direct
packages/mcp test:   ✓ page suggest override did NOT mutate
packages/mcp test:   ✓ page suggest override recorded a new suggestion
packages/mcp test: Page override (direct) beats instance (suggest)
packages/mcp test:   ✓ page direct override → a direct write despite instance suggest
packages/mcp test:   ✓ page direct override mutated the page
packages/mcp test:   ✓ page direct override recorded NO new suggestion
packages/mcp test: Retired OPENBOOK_MCP_ALLOW_DIRECT_EDITS — never enables direct, logs a deprecation
packages/mcp test:   ✓ env var set + policy suggest → still a suggestion
packages/mcp test:   ✓ env var did NOT force a direct write
packages/mcp test:   ✓ env var write recorded a suggestion (not a mutation)
packages/mcp test:   ✓ the connector logged a deprecation for the retired env var
packages/mcp test: Fail-safe: older server (agent-edits route absent) → suggest even under instance=direct
packages/mcp test:   ✓ policy fetch failing (404) → a suggestion, not a direct write
packages/mcp test:   ✓ fail-safe did NOT mutate despite instance=direct
packages/mcp test:   ✓ fail-safe recorded a suggestion
packages/mcp test:   ✓ all six API-9 database writes return typed refusals on a read-only instance
packages/mcp test:   ✓ API-10 writes refuse read-only while get_page_properties remains readable
packages/mcp test: ✅ ALL 44 CHECKS PASSED — MCP writes honor the resolved agent-edits policy per write (env grant retired).
packages/mcp test:   ✓ create_database returns page and database ids
packages/mcp test:   ✓ update_database returns the new name
packages/mcp test:   ✓ create_property returns text/number/select schemas
packages/mcp test:   ✓ update_property returns rename and replacement options
packages/mcp test:   ✓ update_row returns merged typed values
packages/mcp test:   ✓ describe_database returns schema and counts
packages/mcp test:   ✓ unknown database id is a typed error
packages/mcp test:   ✓ unknown property id is a typed error
packages/mcp test:   ✓ wrong property value is typed and leaks no paths
packages/mcp test:   ✓ delete_row soft-deletes to trash
packages/mcp test:   ✓ describeDatabaseTool is shared by agent and MCP
packages/mcp test:   ✓ createDatabaseTool is shared by agent and MCP
packages/mcp test:   ✓ updateDatabaseTool is shared by agent and MCP
packages/mcp test:   ✓ createPropertyTool is shared by agent and MCP
packages/mcp test:   ✓ updatePropertyTool is shared by agent and MCP
packages/mcp test:   ✓ updateRowTool is shared by agent and MCP
packages/mcp test:   ✓ deleteRowTool is shared by agent and MCP
packages/mcp test: ✅ ALL 17 CHECKS PASSED — API-9 database round-trip and negatives.
packages/mcp test:   ✓ oversize base64 is refused before decode or page lookup
packages/mcp test:   ✓ exactly 10 MiB passes the padding-aware pre-check
packages/mcp test:   ✓ 10 MiB plus one byte is refused by the padding-aware pre-check
packages/mcp test:   ✓ in-app agent refuses upload_asset without direct edit access
packages/mcp test:   ✓ in-app agent refuses upload_asset after external-tool taint
packages/mcp test:   ✓ PNG upload returns typed metadata without payload
packages/mcp test:   ✓ image block round-trips its uploaded assetId
packages/mcp test:   ✓ image alt and width update round-trip
packages/mcp test:   ✓ htmlArtifact round-trips its inert assetId
packages/mcp test:   ✓ disallowed MIME returns a typed error
packages/mcp test:   ✓ malformed base64 returns a typed error
packages/mcp test:   ✓ missing page returns a typed error
packages/mcp test:   ✓ suggest/read-only policy refuses immediate upload
packages/mcp test: 13 asset checks passed.
packages/mcp test: OpenBook server up at http://127.0.0.1:4411
packages/mcp test: API-1: tool catalogue exposes nested children + the new write tools
packages/mcp test: API-8: rich text inputs materialize as editor runs
packages/mcp test:   ✓ update_block parses mini-markdown into bold and link runs
packages/mcp test:   ✓ explicit runs round-trip exactly
packages/mcp test:   ✓ plain true keeps marker bytes literal
packages/mcp test:   ✓ unmarked strings preserve existing plain behavior
packages/mcp test:   ✓ the catalogue includes delete_block and update_block_props
packages/mcp test:   ✓ the catalogue includes move_block and insert_blocks
packages/mcp test:   ✓ append_blocks advertises a recursive `children` array in its JSON Schema
packages/mcp test:   ✓ append_blocks documents the table and columns shapes
packages/mcp test: API-1: a nested columns/group payload lands as a real tree
packages/mcp test:   ✓ append_blocks confirms a direct write and counts the nested blocks
packages/mcp test:   ✓ the tree contains columns → column → group → paragraph at increasing depth
packages/mcp test:   ✓ a nested kit input kept its props
packages/mcp test:   ✓ nested block ids are unique and addressable
packages/mcp test:   ✓ read_page projects the nested text
packages/mcp test: API-7: move_block and insert_blocks apply directly at precise positions
packages/mcp test:   ✓ move_block reparents directly using afterId
packages/mcp test:   ✓ insert_blocks accepts a nested payload at index
packages/mcp test:   ✓ direct move + insert produced B, nested insert, C inside the group
packages/mcp test: API-1: a table → row → cell payload lands as a 3×3 table
packages/mcp test:   ✓ the table has 3 rows and 9 cells nested under it
packages/mcp test:   ✓ every cell kept its text in payload order
packages/mcp test:   ✓ the header row kept its props
packages/mcp test:   ✓ move_block allows moving a whole table block
packages/mcp test:   ✓ move_block refuses moving table internals in favour of table_* tools
packages/mcp test: API-1: structural caps are refused with an actionable message
packages/mcp test:   ✓ a 9-level payload is refused (max 8) with an explicit depth error
packages/mcp test:   ✓ an 8-level payload (exactly at the cap) is accepted
packages/mcp test:   ✓ a 401-node payload is refused (max 400) counting nested children
packages/mcp test: API-1 (should-fix 1.1): the container parent/child contract is enforced (no silent drop)
packages/mcp test:   ✓ children on a non-container leaf are refused, naming the offending type
packages/mcp test:   ✓ a top-level row (no table parent) is refused — this is the wall-of-placeholders bug
packages/mcp test:   ✓ a cell directly under a table (skipping row) is refused
packages/mcp test:   ✓ NONE of the rejected structural payloads mutated the page
packages/mcp test: API-1 (should-fix 7.1/7.2): create_artifact_page accepts a NESTED payload and rejects a nested typo / bad structure
packages/mcp test:   ✓ create_artifact_page confirms creation of a nested layout
packages/mcp test:   ✓ create_artifact_page returned a new page id
packages/mcp test:   ✓ the artifact page materialized columns → column → group → paragraph
packages/mcp test:   ✓ create_artifact_page rejects a NESTED typo type, naming it
packages/mcp test:   ✓ create_artifact_page rejects a top-level row (same structural guard as append_blocks)
packages/mcp test: API-4 (direct): update_block_props merges shallowly and null removes a key
packages/mcp test:   ✓ update_block_props confirms a direct write on an image block
packages/mcp test:   ✓ the passed props were merged and the untouched ones survived
packages/mcp test:   ✓ a numeric image width is refused as mistyped
packages/mcp test:   ✓ update_block_props reaches a NESTED block (inside a group)
packages/mcp test:   ✓ an explicit null REMOVED the key (and did not store a null)
packages/mcp test:   ✓ the block text is untouched by a props update
packages/mcp test:   ✓ update_block_props on an unknown id is a clean error naming inspect_page_structure
packages/mcp test:   ✓ update_block_props with no props is refused
packages/mcp test:   ✓ update_block_props refuses the table `ord` key, pointing at the table tools
packages/mcp test:   ✓ update_block_props refuses the cell `col` key
packages/mcp test:   ✓ update_block_props refuses a `col:` column-registry key
packages/mcp test:   ✓ update_block_props refuses a `colbg:` column-tint key
packages/mcp test:   ✓ a refused table-key write left the block untouched
packages/mcp test: API-4 (direct): delete_block removes nested blocks, table rows, and whole containers
packages/mcp test:   ✓ delete_block removes a nested table ROW directly
packages/mcp test:   ✓ the row and its 3 cells are gone (subtree removed)
packages/mcp test:   ✓ the sibling rows survived
packages/mcp test:   ✓ delete_block removes a block nested inside a group
packages/mcp test:   ✓ delete_block removes a whole container
packages/mcp test:   ✓ only the image block remains
packages/mcp test:   ✓ delete_block on an unknown id is a clean error (nothing deleted)
packages/mcp test:   ✓ delete_block on an unknown page reports "Page not found"
packages/mcp test: API-4 (should-fix 4.1): deleting a table's last row/cell removes the table (keyed + legacy)
packages/mcp test:   ✓ deleting the last row of a KEYED table succeeds
packages/mcp test:   ✓ the keyed table is removed WHOLE, the sibling paragraph survives
packages/mcp test:   ✓ deleting the last row of a LEGACY table succeeds
packages/mcp test:   ✓ the legacy table is gone and the doc self-heals to one paragraph (never zero-root)
packages/mcp test:   ✓ deleting the only cell of the only row succeeds
packages/mcp test:   ✓ the 1×1 table is removed whole, the sibling paragraph survives
packages/mcp test: API-4 (should-fix 4.2): delete prunes empty containers and never leaves a zero-root doc
packages/mcp test:   ✓ deleting the only block in a column succeeds
packages/mcp test:   ✓ the emptied column is pruned and the single-column layout is unwrapped
packages/mcp test:   ✓ deleting a page's only block succeeds
packages/mcp test:   ✓ the page self-heals to exactly one paragraph
packages/mcp test: Policy gate: the new tools + nested payloads go through review under suggest
packages/mcp test:   ✓ a nested append under suggest is queued, not applied
packages/mcp test:   ✓ delete_block under suggest is queued, not applied
packages/mcp test:   ✓ update_block_props under suggest is queued, not applied
packages/mcp test:   ✓ move_block under suggest is queued, not applied
packages/mcp test:   ✓ insert_blocks under suggest keeps a nested payload
packages/mcp test:   ✓ five suggestions were recorded
packages/mcp test:   ✓ move_block uses the move review kind and insert_blocks reuses insert
packages/mcp test:   ✓ insert_blocks suggestion preserves recursive children
packages/mcp test:   ✓ the queued nested payload kept its children (3 rows × 3 cells)
packages/mcp test:   ✓ delete_block maps to the `delete` suggestion kind and targets the block
packages/mcp test:   ✓ update_block_props maps to `replace-text` with applyKind set_block_props (the bridge's patchBlock)
packages/mcp test:   ✓ both new suggestions are authored by the MCP client
packages/mcp test:   ✓ the diff card shows a before/after for each
packages/mcp test:   ✓ NOTHING was mutated under suggest (block still there, props unchanged)
packages/mcp test:   ✓ a cap violation errors under suggest too, queueing nothing
packages/mcp test:   ✓ insert_blocks enforces the same depth cap before queueing
packages/mcp test: ✅ ALL 80 CHECKS PASSED — nested children over MCP + delete_block / update_block_props.
packages/mcp test: OpenBook server up at http://127.0.0.1:4412
packages/mcp test: Catalogue: the twelve table tools are exposed with descriptions
packages/mcp test:   ✓ every table tool is registered
packages/mcp test:   ✓ each documents that coordinates are RENDER order
packages/mcp test:   ✓ table_insert_row documents the header-row refusal
packages/mcp test:   ✓ the delete tools document that the last row/column removes the table
packages/mcp test: A table built by append_blocks is immediately inspectable + operable
packages/mcp test:   ✓ inspect_table with no tableId lists the page's tables
packages/mcp test:   ✓ the table reads back 3×3 with a header row
packages/mcp test:   ✓ an append_blocks table has NO order keys yet (reported as unmigrated)
packages/mcp test:   ✓ cells are reported in payload order with addressable ids
packages/mcp test: The header-row invariant (the editor hides insert-above on row 0)
packages/mcp test:   ✓ inserting a row ABOVE the header row is refused with an explanation
packages/mcp test:   ✓ the refusal changed nothing
packages/mcp test: table_insert_row: the first op migrates col:/ord without reshuffling
packages/mcp test:   ✓ the insert reports a direct apply and the new size
packages/mcp test:   ✓ order keys are now assigned (migrated) with 3 columns
packages/mcp test:   ✓ the blank row landed at render position 1 and nothing else moved
packages/mcp test:   ✓ the stored projection really carries col:/ord props
packages/mcp test: table_set_cell by index and by cell id
packages/mcp test:   ✓ a cell id alone identifies the table AND the coordinates
packages/mcp test:   ✓ both addressing styles wrote the cells they meant
packages/mcp test: Columns: insert, move, tint, delete
packages/mcp test:   ✓ a column was inserted at render position 1 with a cell in every row
packages/mcp test:   ✓ table_move_column reports success
packages/mcp test:   ✓ the moved column is last and the others closed up
packages/mcp test:   ✓ a column tint is stored as colbg:<colId> on the table
packages/mcp test:   ✓ a column width is stored as colw:<colId> on the table
packages/mcp test:   ✓ deleting a column by id removes its cells everywhere
packages/mcp test:   ✓ the deleted column left no orphan colbg entry
packages/mcp test:   ✓ the deleted column left no orphan colw entry
packages/mcp test: Rows: duplicate, move (by id), tint, delete
packages/mcp test:   ✓ duplicate_row copies the row directly below with FRESH ids
packages/mcp test:   ✓ the duplicated cells are distinct blocks
packages/mcp test:   ✓ table_move_row addressed by row ID moved it to render position 1
packages/mcp test:   ✓ the header row stayed put
packages/mcp test:   ✓ a row tint is the row block's bg prop
packages/mcp test:   ✓ table_delete_row by id succeeds
packages/mcp test:   ✓ the row is gone and the rest kept their render order
packages/mcp test: Bounds + unknown-id errors are clean and actionable
packages/mcp test:   ✓ an out-of-range index names the table dimensions
packages/mcp test:   ✓ an unknown cell id points at inspect_table
packages/mcp test:   ✓ an unknown column id errors cleanly
packages/mcp test:   ✓ an unknown tableId errors cleanly
packages/mcp test:   ✓ omitting every way of naming the table is refused
packages/mcp test:   ✓ a move target past the axis (counted with the row removed) is refused
packages/mcp test:   ✓ every refusal left the table exactly as it was
packages/mcp test: A table cell also answers to the generic block tools (no regression)
packages/mcp test:   ✓ update_block can still write a cell by its block id
packages/mcp test: The last row / column removes the WHOLE table (editor parity)
packages/mcp test:   ✓ deleting the last row says the whole table block was removed
packages/mcp test:   ✓ the table really is gone from the page
packages/mcp test: Policy gate: every table op queues a reviewable table-op suggestion
packages/mcp test:   ✓ table_insert_row under suggest is queued, not applied
packages/mcp test:   ✓ all five ops were queued
packages/mcp test:   ✓ every one reviews as the `table-op` suggestion kind anchored on the TABLE block
packages/mcp test:   ✓ each payload carries the bridge applyKind = the tool name
packages/mcp test:   ✓ payloads carry the page, the table, and RESOLVED sorted coordinates
packages/mcp test:   ✓ a node-targeting op also carries the STABLE id it resolved to (survives a reorder in review)
packages/mcp test:   ✓ a cell op carries the cell id and a before→after for the diff card
packages/mcp test:   ✓ authorship is the MCP client
packages/mcp test:   ✓ NOTHING was mutated under suggest — same grid, still unmigrated
packages/mcp test:   ✓ the header guard bites under suggest too, queueing nothing
packages/mcp test:   ✓ bounds are validated BEFORE the policy branch
packages/mcp test: An accepted suggestion applies IDENTICALLY to a direct write
packages/mcp test:   ✓ replaying the queued payload yields the same grid as the direct write
packages/mcp test:   ✓ …and it really moved something
packages/mcp test: ✅ ALL 54 CHECKS PASSED — table structure tools over MCP (API-3).
packages/mcp test: FORM-7 read tools + capability redaction
packages/mcp test:   ✓ list_forms recursively finds the nested form
packages/mcp test:   ✓ list_forms returns summary fields and the database binding
packages/mcp test:   ✓ list_forms never returns either submission key
packages/mcp test:   ✓ get_form_schema returns the fields plus enabled/databaseId
packages/mcp test:   ✓ get_form_schema recursively redacts the capability
packages/mcp test:   ✓ inspect_page_structure still shows the nested form
packages/mcp test:   ✓ inspect_page_structure redacts both key copies
packages/mcp test: FORM-7 update_block_props capability guard
packages/mcp test:   ✓ update_block_props refuses a top-level submissionKey write
packages/mcp test:   ✓ update_block_props refuses a nested schema.submissionKey smuggle
packages/mcp test:   ✓ both refused probes leave both stored key copies unchanged
packages/mcp test:   ✓ update_block_props still applies harmless form props directly
packages/mcp test:   ✓ the merged-props success echo contains no submission key bytes
packages/mcp test: FORM-7 list_form_submissions filtering + cursor
packages/mcp test:   ✓ list_form_submissions returns one marked row and a cursor
packages/mcp test:   ✓ pagination returns exactly the two rows marked for this form
packages/mcp test:   ✓ the last submissions page omits nextCursor
packages/mcp test:   ✓ a cursor from outside the filtered form is rejected
packages/mcp test:   ✓ a database hosted by another page is rejected
packages/mcp test:   ✓ a schema-only database binding is not authoritative
packages/mcp test: FORM-7 strict field-op schemas + suggest mode
packages/mcp test:   ✓ zod rejects an unknown field kind before the handler
packages/mcp test:   ✓ zod rejects an empty update patch
packages/mcp test:   ✓ zod rejects an unknown operation discriminator
packages/mcp test:   ✓ zod rejects a non-http(s) confirmation redirect
packages/mcp test:   ✓ update_form_field queues a suggestion on a suggest page
packages/mcp test:   ✓ suggest-mode update_form_field leaves the block unchanged
packages/mcp test:   ✓ the field suggestion targets the form block through set_block_props
packages/mcp test:   ✓ the suggestion preserves the submission capability without exposing it in the tool result
packages/mcp test:   ✓ set_form_settings also queues through the suggest policy
packages/mcp test:   ✓ suggest-mode set_form_settings leaves settings unchanged
packages/mcp test: FORM-7 direct field operations + settings
packages/mcp test:   ✓ add applies directly on a direct page with a 43-character key
packages/mcp test:   ✓ update applies directly
packages/mcp test:   ✓ reorder applies directly
packages/mcp test:   ✓ remove applies directly
packages/mcp test:   ✓ all direct operations landed in final order with the patch
packages/mcp test:   ✓ direct field edits preserve both 43-character key copies
packages/mcp test:   ✓ set_form_settings applies directly
packages/mcp test:   ✓ settings synchronize outer gate props and nested schema
packages/mcp test:   ✓ settings carry label/confirmation and accept maxSubmissions=0
packages/mcp test:   ✓ set_form_settings cannot rotate or corrupt the key
packages/mcp test:   ✓ nullable settings clear optional values directly
packages/mcp test:   ✓ cleared settings are removed rather than stored as null
packages/mcp test: ✅ ALL 40 CHECKS PASSED — FORM-7 tools, policy handling, pagination, validation, and key redaction verified.
packages/mcp test: OpenBook server up at http://127.0.0.1:4414
packages/mcp test: API-2: the tool catalogue exposes list_block_types
packages/mcp test:   ✓ list_block_types is registered
packages/mcp test:   ✓ create_artifact_page advertises catalogue types in its schema (generated, not hand-written)
packages/mcp test: API-2: EVERY catalogued type is creatable via create_artifact_page (coverage)
packages/mcp test:   ✓ one artifact page holding every catalogued type is accepted
packages/mcp test:   ✓ stored page contains a "paragraph" block
packages/mcp test:   ✓ stored page contains a "heading" block
packages/mcp test:   ✓ stored page contains a "list" block
packages/mcp test:   ✓ stored page contains a "todo" block
packages/mcp test:   ✓ stored page contains a "quote" block
packages/mcp test:   ✓ stored page contains a "callout" block
packages/mcp test:   ✓ stored page contains a "code" block
packages/mcp test:   ✓ stored page contains a "notes" block
packages/mcp test:   ✓ stored page contains a "divider" block
packages/mcp test:   ✓ stored page contains a "image" block
packages/mcp test:   ✓ stored page contains a "htmlArtifact" block
packages/mcp test:   ✓ stored page contains a "columns" block
packages/mcp test:   ✓ stored page contains a "column" block
packages/mcp test:   ✓ stored page contains a "table" block
packages/mcp test:   ✓ stored page contains a "row" block
packages/mcp test:   ✓ stored page contains a "cell" block
packages/mcp test:   ✓ stored page contains a "group" block
packages/mcp test:   ✓ stored page contains a "tabs" block
packages/mcp test:   ✓ stored page contains a "tab" block
packages/mcp test:   ✓ stored page contains a "accordion" block
packages/mcp test:   ✓ stored page contains a "accordionsection" block
packages/mcp test:   ✓ stored page contains a "slider" block
packages/mcp test:   ✓ stored page contains a "number" block
packages/mcp test:   ✓ stored page contains a "textfield" block
packages/mcp test:   ✓ stored page contains a "longtext" block
packages/mcp test:   ✓ stored page contains a "richtext" block
packages/mcp test:   ✓ stored page contains a "toggle" block
packages/mcp test:   ✓ stored page contains a "radio" block
packages/mcp test:   ✓ stored page contains a "dropdown" block
packages/mcp test:   ✓ stored page contains a "checklist" block
packages/mcp test:   ✓ stored page contains a "choicecards" block
packages/mcp test:   ✓ stored page contains a "searchselect" block
packages/mcp test:   ✓ stored page contains a "tagfield" block
packages/mcp test:   ✓ stored page contains a "location" block
packages/mcp test:   ✓ stored page contains a "actionbutton" block
packages/mcp test:   ✓ stored page contains a "kitchart" block
packages/mcp test:   ✓ stored page contains a "statuslight" block
packages/mcp test:   ✓ stored page contains a "progressbar" block
packages/mcp test:   ✓ stored page contains a "formula" block
packages/mcp test:   ✓ stored page contains a "linkcard" block
packages/mcp test:   ✓ stored page contains a "tooltipcard" block
packages/mcp test:   ✓ stored page contains a "dbview" block
packages/mcp test:   ✓ stored page contains a "dbform" block
packages/mcp test:   ✓ stored page contains a "form" block
packages/mcp test: API-2: unknown types are refused with a pointer at list_block_types
packages/mcp test:   ✓ a typo'd type is refused naming the type
packages/mcp test:   ✓ the refusal points at list_block_types
packages/mcp test: API-2: the table cell-count rule holds on both write paths
packages/mcp test:   ✓ create_artifact_page refuses a ragged table
packages/mcp test:   ✓ append_blocks refuses a ragged table
packages/mcp test: API-2: update_block_props validates declared prop VALUE types
packages/mcp test:   ✓ a declared prop with the wrong value type is refused, naming prop and expectation
packages/mcp test:   ✓ an invalid structured option is refused with a typed error naming opts
packages/mcp test: API-2: plugin block types — rejected while uninstalled, accepted once installed
packages/mcp test:   ✓ an uninstalled plugin's type is refused as not installed
packages/mcp test:   ✓ list_block_types lists every catalogued core + kit type
packages/mcp test:   ✓ with no plugins installed, pluginBlocks is empty
packages/mcp test:   ✓ list_block_types filters its payload to requested types
packages/mcp test:   ✓ after installing the bundled ledger plugin, its declared blocks are listed
packages/mcp test:   ✓ plugin entries carry a description
packages/mcp test:   ✓ the installed plugin's namespaced type is now accepted
packages/mcp test: All 60 checks passed.
packages/mcp test: ✅ README covers all 50 registered MCP tools and agent reference sections
packages/mcp test: OpenBook sidecar up (socket + TCP) at http://127.0.0.1:4409
packages/mcp test:   ✓ the server advertises a stable instanceId
packages/mcp test:   ✓ the foreign server has a DIFFERENT instanceId
packages/mcp test: Happy path: connector over the unified endpoint lists the SAME pages
packages/mcp test:   ✓ connector lists the page the server API shows
packages/mcp test:   ✓ list_pages inherits the client list filter (no MCP-side reimplementation)
packages/mcp test:   ✓ search_notes inherits the client search filter
packages/mcp test:   ✓ an unlisted page remains directly readable
packages/mcp test: Refusal: foreign responder on the target endpoint
packages/mcp test:   ✓ connector exits non-zero on an identity mismatch
packages/mcp test:   ✓ the error names the mismatch (never silently adopts the foreign server)
packages/mcp test: Refusal: nothing listening on the target port
packages/mcp test:   ✓ connector exits non-zero when the endpoint is unreachable
packages/mcp test:   ✓ the error is a clear reachability message
packages/mcp test: ✅ ALL 10 CHECKS PASSED — unified endpoint + instance verification.
packages/mcp test:   ✓ paragraph
packages/mcp test:   ✓ heading
packages/mcp test:   ✓ list
packages/mcp test:   ✓ todo
packages/mcp test:   ✓ quote
packages/mcp test:   ✓ callout
packages/mcp test:   ✓ code
packages/mcp test:   ✓ notes
packages/mcp test:   ✓ divider
packages/mcp test:   ✓ image
packages/mcp test:   ✓ htmlArtifact
packages/mcp test:   ✓ columns
packages/mcp test:   ✓ column
packages/mcp test:   ✓ table
packages/mcp test:   ✓ row
packages/mcp test:   ✓ cell
packages/mcp test:   ✓ group
packages/mcp test:   ✓ tabs
packages/mcp test:   ✓ tab
packages/mcp test:   ✓ accordion
packages/mcp test:   ✓ accordionsection
packages/mcp test:   ✓ slider
packages/mcp test:   ✓ number
packages/mcp test:   ✓ textfield
packages/mcp test:   ✓ longtext
packages/mcp test:   ✓ richtext
packages/mcp test:   ✓ toggle
packages/mcp test:   ✓ radio
packages/mcp test:   ✓ dropdown
packages/mcp test:   ✓ checklist
packages/mcp test:   ✓ choicecards
packages/mcp test:   ✓ searchselect
packages/mcp test:   ✓ tagfield
packages/mcp test:   ✓ location
packages/mcp test:   ✓ actionbutton
packages/mcp test:   ✓ kitchart
packages/mcp test:   ✓ statuslight
packages/mcp test:   ✓ progressbar
packages/mcp test:   ✓ formula
packages/mcp test:   ✓ linkcard
packages/mcp test:   ✓ tooltipcard
packages/mcp test:   ✓ dbview
packages/mcp test:   ✓ dbform
packages/mcp test:   ✓ form
packages/mcp test:   ✓ openbook.ledger/journal-entry
packages/mcp test:   ✓ openbook.ledger/trial-balance
packages/mcp test:   ✓ openbook.ledger/account-register
packages/mcp test:   ✓ openbook.ledger/bank-import
packages/mcp test:   ✓ openbook.ledger/reconcile
packages/mcp test:   ✓ openbook.ledger/balance-sheet
packages/mcp test:   ✓ openbook.ledger/income-statement
packages/mcp test:   ✓ openbook.ledger/period-close
packages/mcp test:   ✓ openbook.ledger/beancount-export
packages/mcp test: All 44 catalogue types + 9 plugin blocks have MCP API coverage; exemptions: none.
packages/mcp test: Done
packages/server test:  Test Files  97 passed (97)
packages/server test:       Tests  1336 passed | 6 skipped (1342)
packages/server test:    Start at  23:34:06
packages/server test:    Duration  3819.18s (transform 6.63s, setup 0ms, import 67.16s, tests 3724.62s, environment 19ms)
packages/server test: Done

> open-book@0.0.0-workspace test:e2e /Users/eliot/Workspaces/OpenBook-wt-meet-1
> pnpm --filter @book.dev/server run test:e2e && pnpm --filter @book.dev/mcp run test:e2e


> @book.dev/server@3.17.0 test:e2e /Users/eliot/Workspaces/OpenBook-wt-meet-1/packages/server
> tsx scripts/e2e.mts


=== 1. EMBEDDED MODE (embedded PGlite) ===
  server up at http://127.0.0.1:4401
  ✓ health endpoint returns ok

[embedded] API responses are non-cacheable
  ✓ /api/pages sends Cache-Control: no-store
  ✓ /api/trash sends Cache-Control: no-store

[embedded] CRUD via HttpDataClient
  ✓ create returns a uuid
  ✓ create round-trips name
  ✓ create round-trips values
  ✓ create round-trips names
  ✓ create sets timestamps
  ✓ get returns the page
  ✓ get round-trips data
  ✓ get of unknown id -> null
  ✓ list includes the page
  ✓ list items carry no data payload
  ✓ update keeps id
  ✓ update replaces values
  ✓ update bumps updatedAt
  ✓ duplicate name allowed (distinct page)
  ✓ both same-named pages are listed
  ✓ rename changes the name
  ✓ rename preserves data
  ✓ delete returns true
  ✓ get after delete -> null
  ✓ second delete returns false

[embedded] Page properties: owner, verification, backlinks
  ✓ backlinks include the linking page
  ✓ backlinks exclude the target itself
  ✓ a never-linked page has no backlinks
  ✓ owner persists
  ✓ verification persists
  ✓ a second property merges (owner preserved)
  ✓ a content save preserves properties
  ✓ a relation property counts as a backlink
  ✓ the mention link is still a backlink too
  ✓ backlink clears when the linker is trashed

[embedded] Database via HttpDataClient
  ✓ create database returns id
  ✓ database is linked to its host page
  ✓ database round-trips schema
  ✓ host page reports hostedDatabaseId
  ✓ host page keeps its own content
  ✓ database is reachable via its host page
  ✓ host page appears in the page list
  ✓ row create returns a page id
  ✓ row carries its database membership
  ✓ rows are excluded from the page list
  ✓ listRows returns both rows
  ✓ row round-trips manual property
  ✓ row projects exported cell value
  ✓ rows list in creation order
  ✓ reorderRows sets the manual order
  ✓ new row appends at the bottom
  ✓ sub-item carries its parentId
  ✓ top-level rows have a null parentId
  ✓ exports refresh after a content save
  ✓ updateRow changes the title
  ✓ updateRow changes a property
  ✓ updateRow leaves exports intact
  ✓ applyView sorts by title ascending
  ✓ delete host page (soft)
  ✓ host page hidden after delete
  ✓ database survives a soft delete
  ✓ host page restores
  ✓ rows survive the round-trip
  ✓ purge host page
  ✓ database removed by cascade after purge
  ✓ row page removed by cascade after purge

[embedded] Nested pages via HttpDataClient
  ✓ child records its parent
  ✓ grandchild records its parent
  ✓ top-level page has no parent
  ✓ nested pages appear in the list with parentId
  ✓ content save preserves the parent
  ✓ delete parent (soft)
  ✓ child hidden with the parent
  ✓ grandchild hidden with the parent
  ✓ parent is a trash root
  ✓ nested child is not a separate trash root
  ✓ restore parent
  ✓ child restored with the parent
  ✓ grandchild restored with the parent
  ✓ parent left the trash

[embedded] Page ordering & movePage
  ✓ new children list in creation order (appended)
  ✓ movePage returns the moved page
  ✓ movePage reorders siblings
  ✓ movePage re-parents the page
  ✓ the re-nested page leaves its old group
  ✓ the re-nested page joins its new parent
  ✓ movePage rejects a cycle (409)

[embedded] Whole-space backup: export / import
  ✓ export includes live pages with data
  ✓ export includes nested pages
  ✓ copy import creates new pages
  ✓ copy import suffixes clashing names
  ✓ copy import: parent copied under a fresh id
  ✓ copy import: nesting preserved
  ✓ overwrite replaces by id (no new page)
  ✓ overwrite applies the new content

[embedded] Trash: restore, purge, empty
  ✓ soft delete returns true
  ✓ soft-deleted page is hidden
  ✓ soft-deleted page is in the trash
  ✓ a trashed name is freed for reuse
  ✓ restore brings the page back
  ✓ restore keeps the original name despite a live twin
  ✓ restored page is visible again
  ✓ purge a single trashed page
  ✓ purging a missing page returns false
  ✓ a purged page cannot be restored
  ✓ delete a row (soft)
  ✓ row leaves the database view
  ✓ row appears in the trash
  ✓ restore the row
  ✓ row returns to the database view
  ✓ emptyTrash purges remaining trash
  ✓ trash is empty afterwards

[embedded] optional local AI (mock engine)
  ✓ ai defaults to off
  ✓ lexical search works with AI off
  ✓ lexical search ranks the budget note first
  ✓ search returns a snippet
  ✓ config accepts the mock provider
  ✓ mock engine reports ready + embeddings
  ✓ search upgrades to hybrid with an embedding engine
  ✓ task breakdown returns parsed tasks
  ✓ tasks are clean strings (no list markers)
  ✓ completion streams tokens over SSE
  ✓ completion stream closes with done
  ✓ reindex counts pages
  ✓ unknown provider rejected (400)
  ✓ agent calls search_notes first
  ✓ agent streams the tool result
  ✓ agent ends with a grounded final answer
  ✓ agent events arrive in order (tool → result → final)
  ✓ agent rejects an empty conversation (400)

[embedded] extensions (plugins API)
  ✓ install returns the stored plugin
  ✓ installed plugin is listed
  ✓ signature survives the round-trip
  ✓ stored package verifies against the trusted key
  ✓ malformed id rejected (400)
  ✓ missing entry file rejected (400)
  ✓ disable persists
  ✓ remove returns true
  ✓ removed plugin is gone

=== 2. PERSISTENCE ACROSS RESTART ===
  ✓ seeded a page before restart
  server stopped
  server restarted at http://127.0.0.1:4401
  ✓ page survived restart
  ✓ data survived restart
  ✓ manual order survived restart

=== 3. HEADLESS MODE (Postgres wire protocol) ===
  postgres-compatible socket up at 127.0.0.1:5599
  headless server up at http://127.0.0.1:4402

[headless] CRUD via HttpDataClient
  ✓ create returns a uuid
  ✓ create round-trips name
  ✓ create round-trips values
  ✓ create round-trips names
  ✓ create sets timestamps
  ✓ get returns the page
  ✓ get round-trips data
  ✓ get of unknown id -> null
  ✓ list includes the page
  ✓ list items carry no data payload
  ✓ update keeps id
  ✓ update replaces values
  ✓ update bumps updatedAt
  ✓ duplicate name allowed (distinct page)
  ✓ both same-named pages are listed
  ✓ rename changes the name
  ✓ rename preserves data
  ✓ delete returns true
  ✓ get after delete -> null
  ✓ second delete returns false

[headless] Page properties: owner, verification, backlinks
  ✓ backlinks include the linking page
  ✓ backlinks exclude the target itself
  ✓ a never-linked page has no backlinks
  ✓ owner persists
  ✓ verification persists
  ✓ a second property merges (owner preserved)
  ✓ a content save preserves properties
  ✓ a relation property counts as a backlink
  ✓ the mention link is still a backlink too
  ✓ backlink clears when the linker is trashed

[headless] Database via HttpDataClient
  ✓ create database returns id
  ✓ database is linked to its host page
  ✓ database round-trips schema
  ✓ host page reports hostedDatabaseId
  ✓ host page keeps its own content
  ✓ database is reachable via its host page
  ✓ host page appears in the page list
  ✓ row create returns a page id
  ✓ row carries its database membership
  ✓ rows are excluded from the page list
  ✓ listRows returns both rows
  ✓ row round-trips manual property
  ✓ row projects exported cell value
  ✓ rows list in creation order
  ✓ reorderRows sets the manual order
  ✓ new row appends at the bottom
  ✓ sub-item carries its parentId
  ✓ top-level rows have a null parentId
  ✓ exports refresh after a content save
  ✓ updateRow changes the title
  ✓ updateRow changes a property
  ✓ updateRow leaves exports intact
  ✓ applyView sorts by title ascending
  ✓ delete host page (soft)
  ✓ host page hidden after delete
  ✓ database survives a soft delete
  ✓ host page restores
  ✓ rows survive the round-trip
  ✓ purge host page
  ✓ database removed by cascade after purge
  ✓ row page removed by cascade after purge

[headless] Nested pages via HttpDataClient
  ✓ child records its parent
  ✓ grandchild records its parent
  ✓ top-level page has no parent
  ✓ nested pages appear in the list with parentId
  ✓ content save preserves the parent
  ✓ delete parent (soft)
  ✓ child hidden with the parent
  ✓ grandchild hidden with the parent
  ✓ parent is a trash root
  ✓ nested child is not a separate trash root
  ✓ restore parent
  ✓ child restored with the parent
  ✓ grandchild restored with the parent
  ✓ parent left the trash

[headless] Page ordering & movePage
  ✓ new children list in creation order (appended)
  ✓ movePage returns the moved page
  ✓ movePage reorders siblings
  ✓ movePage re-parents the page
  ✓ the re-nested page leaves its old group
  ✓ the re-nested page joins its new parent
  ✓ movePage rejects a cycle (409)

[headless] Trash: restore, purge, empty
  ✓ soft delete returns true
  ✓ soft-deleted page is hidden
  ✓ soft-deleted page is in the trash
  ✓ a trashed name is freed for reuse
  ✓ restore brings the page back
  ✓ restore keeps the original name despite a live twin
  ✓ restored page is visible again
  ✓ purge a single trashed page
  ✓ purging a missing page returns false
  ✓ a purged page cannot be restored
  ✓ delete a row (soft)
  ✓ row leaves the database view
  ✓ row appears in the trash
  ✓ restore the row
  ✓ row returns to the database view
  ✓ emptyTrash purges remaining trash
  ✓ trash is empty afterwards

=== 4. TRASH CLEANUP JOB ===
  ✓ janitor: page created
  ✓ janitor: soft delete
OpenBook trash cleanup: purged 1 expired page(s)
  ✓ janitor: cleanup job purged the expired page
  ✓ janitor: purged page is gone for good

=== 5. ACCESS-TOKEN AUTH ===
  ✓ tokenless request rejected (401)
  ✓ tokenless write rejected (401)
  ✓ token-bearing client can write
  ✓ token-bearing client can read
  ✓ raw ?token= authenticates
  ✓ raw missing token is 401
  ✓ health stays open without a token

=== 6. LEDGER EXPORT + VERIFY ===
  ✓ ledger: entry posted with entry number 1
  ✓ ledger: canonical CSV export is byte-stable
  ✓ ledger: CSV carries the posting rows
  ✓ ledger: verify route answers 200
  ✓ ledger: independent verifier reports a CLEAN book

✅ ALL 256 CHECKS PASSED — embedded, persistence, headless, trash-cleanup, access-token, and ledger flows verified.

> @book.dev/mcp@3.17.0 test:e2e /Users/eliot/Workspaces/OpenBook-wt-meet-1/packages/mcp
> tsx scripts/e2e.mts


OpenBook server up at http://127.0.0.1:4402

MCP handshake + tool catalogue
  ✓ handshake reports the openbook server
  ✓ the registered tool set is non-trivial and duplicate-free
  ✓ all 50 registered tools are listed (derived from src/server.ts)
  ✓ tools carry descriptions
  ✓ handshake advertises upload_asset

Read tools
  ✓ list_pages includes seeded pages
  ✓ read_page returns title and body
  ✓ read_page flags a missing page as an error
  ✓ search_notes ranks the planning note first

Write tools
  ✓ create_page returns the new id
  ✓ set_page_appearance is available through the handshake
  ✓ move_page is available through the handshake
  ✓ set_page_properties is available through the handshake
  ✓ get_page_properties is available through the handshake
  ✓ append_to_page queues a suggestion
  ✓ append_to_page did not mutate the page
  ✓ append_to_page recorded an insert suggestion
  ✓ append_to_page proposes on a block-editor page
  ✓ append_to_page did not mutate the block page
  ✓ create_page allows a duplicate title (new page)

Artifact tool
  ✓ create_artifact_page returns the new id
  ✓ the artifact is stamped for the block editor
  ✓ all five blocks landed in order
  ✓ read_page sees the artifact heading
  ✓ unknown block types are rejected

Database tools
  ✓ describe_database is callable in the handshake
  ✓ create_database is callable in the handshake
  ✓ update_database is callable in the handshake
  ✓ create_property is callable in the handshake
  ✓ update_property is callable in the handshake
  ✓ update_row is callable in the handshake
  ✓ delete_row is callable in the handshake
  ✓ list_database_rows lists the seeded row
  ✓ create_database_row confirms
  ✓ the new row shows up
  ✓ list_database_rows flags a page without a database

Inspection tools (T11)
  ✓ inspect_page_structure shows the block tree
  ✓ inspect_page_structure exposes block ids
  ✓ get_kit_values reads the published input
  ✓ get_kit_values reports a page with no kit values
  ✓ list_db_views lists the database views
  ✓ get_db_row reads the row by id

Write tools (T11) — default = reviewable suggestions
  ✓ set_kit_value queues a suggestion
  ✓ set_kit_value did not mutate the value (still 3)
  ✓ set_kit_value rejects an unknown input
  ✓ update_block queues a suggestion
  ✓ update_block did not mutate the heading
  ✓ update_block rejects an unknown block id
  ✓ append_blocks queues a suggestion
  ✓ append_blocks did not mutate the page
  ✓ append_blocks refuses legacy editor pages
  ✓ move_block queues a suggestion
  ✓ insert_blocks queues a nested suggestion
  ✓ the artifact page collected the queued edit suggestions
  ✓ set_db_cell queues a suggestion
  ✓ set_db_cell did not mutate the cell
  ✓ set_db_cell recorded a set-cell suggestion
  ✓ set_db_cell rejects an unknown property

Form tools (FORM-7) — redacted reads, suggest then direct
  ✓ list_forms finds the seeded form with summary metadata
  ✓ list_forms does not expose the submission key
  ✓ get_form_schema returns the field and binding
  ✓ get_form_schema redacts both key copies
  ✓ inspect_page_structure redacts form capabilities
  ✓ list_form_submissions returns only the sys_form_submission-marked row
  ✓ update_form_field queues a suggestion under the default policy
  ✓ suggest-mode update_form_field leaves the form unchanged
  ✓ the form edit is a set_block_props suggestion targeting the form block
  ✓ update_form_field applies directly under a page direct override
  ✓ set_form_settings applies directly
  ✓ direct field and settings edits are readable and still redacted

✅ ALL 70 CHECKS PASSED — MCP handshake, catalogue, and every tool verified.

```

</details>

<details>
<summary>Initial sandboxed pnpm verify (stopped after confirmed failures; exit 130)</summary>

```text

> open-book@0.0.0-workspace verify /Users/eliot/Workspaces/OpenBook-wt-meet-1
> pnpm run test:eslint-rules && pnpm run build:libs && pnpm run check:gen && pnpm run typecheck && pnpm run lint && pnpm run test && pnpm run test:e2e


> open-book@0.0.0-workspace test:eslint-rules /Users/eliot/Workspaces/OpenBook-wt-meet-1
> node --test eslint-rules/*.test.mjs

✔ allows spacing-scale utilities and non-spacing arbitrary values (16.106917ms)
✔ flags arbitrary padding, margin, and gap values in className (5.420291ms)
✔ checks nested, template, and conventionally named hoisted class strings (2.09ms)
✔ allows paint-only hover changes and non-hover geometry (13.772042ms)
✔ flags every guarded hover-geometry utility family (14.331958ms)
✔ flags display swaps in either class ordering and nested class strings (3.465834ms)
ℹ tests 6
ℹ suites 0
ℹ pass 6
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 138.82

> open-book@0.0.0-workspace build:libs /Users/eliot/Workspaces/OpenBook-wt-meet-1
> pnpm --filter @book.dev/sdk run build && pnpm --filter @book.dev/ui run build && pnpm --filter @book.dev/mcp run build && pnpm --filter @book.dev/server run build


> @book.dev/sdk@3.17.0 build /Users/eliot/Workspaces/OpenBook-wt-meet-1/packages/sdk
> tsc -p tsconfig.build.json


> @book.dev/ui@3.17.0 build /Users/eliot/Workspaces/OpenBook-wt-meet-1/packages/ui
> pnpm run gen:bundled-plugins && pnpm run build:viewer && vite build && tsc


> @book.dev/ui@3.17.0 gen:bundled-plugins /Users/eliot/Workspaces/OpenBook-wt-meet-1/packages/ui
> node --import tsx scripts/bundlePlugins.ts

[bundlePlugins] OPENBOOK_REGISTRY_PRIVATE_KEY is unset — signing with the committed TEST-ONLY key (scripts/test-registry-key.json). Fine for dev/test; production builds must set the secret (docs/plugin-signing.md).
wrote src/plugins/bundled.gen.ts (1 plugin(s), signed by OpenBook Test Registry [test])
wrote src/export/ledgerFolds.gen (2 fold module(s))

> @book.dev/ui@3.17.0 build:viewer /Users/eliot/Workspaces/OpenBook-wt-meet-1/packages/ui
> vite build --config vite.viewer.config.js

vite v8.0.14 building client environment for production...
[2K
transforming...✓ 2076 modules transformed.
rendering chunks...
computing gzip size...
src/export/vendor/openbook-viewer.js  1,727.92 kB │ gzip: 486.47 kB

✓ built in 512ms
vite v8.0.14 building client environment for production...
[2K
transforming...✓ 356 modules transformed.
rendering chunks...
computing gzip size...
dist/style.css                         190.24 kB │ gzip:  31.11 kB
dist/rolldown-runtime-Dy4uBu1J.js        0.24 kB │ gzip:   0.21 kB
dist/emoji-Bmft6RPl.js                   0.30 kB │ gzip:   0.23 kB
dist/databaseMapLeaflet-8LYcHcR6.js      2.70 kB │ gzip:   1.37 kB
dist/pageCover-DG_o7L9m.js               3.06 kB │ gzip:   1.27 kB
dist/chartData-DQo78QVa.js               3.41 kB │ gzip:   1.44 kB
dist/exportSite-BhXgGHTe.js              5.19 kB │ gzip:   2.14 kB
dist/toPdf-DYGZU1B5.js                   5.94 kB │ gzip:   2.52 kB
dist/themes-CDtwgOr5.js                  9.86 kB │ gzip:   2.99 kB
dist/quickjsVm-BLKBOeOk.js              10.75 kB │ gzip:   3.58 kB
dist/EmojiGrid-wB896zFy.js              10.84 kB │ gzip:   4.36 kB
dist/exportBlocks-CNF_rL3d.js           36.70 kB │ gzip:  10.00 kB
dist/lucideIcons-DzkS5mW9.js            83.10 kB │ gzip:  25.98 kB
dist/pageIcon-Dn-g2w6N.js              355.97 kB │ gzip: 110.27 kB
dist/scope-DjPmYdi5.js                 786.80 kB │ gzip: 329.50 kB
dist/openbook-viewer-DleN9qK4.js     1,738.48 kB │ gzip: 487.23 kB
dist/index.js                        2,962.77 kB │ gzip: 813.80 kB

[INEFFECTIVE_DYNAMIC_IMPORT] src/plugins/index.ts is dynamically imported by src/screens/BlockPageDocument.tsx but also statically imported by src/blockeditor/MissingPluginBlock.tsx, src/components/ExtensionsSettings.tsx, src/components/PluginBoot.tsx, src/components/useAppCommands.ts, src/screens/BlockPageDocument.tsx, dynamic import will not move module into another chunk.

[INEFFECTIVE_DYNAMIC_IMPORT] src/export/toHtml.ts is dynamically imported by src/screens/BlockPageDocument.tsx but also statically imported by src/index.ts, dynamic import will not move module into another chunk.

✓ built in 444ms

> @book.dev/mcp@3.17.0 build /Users/eliot/Workspaces/OpenBook-wt-meet-1/packages/mcp
> tsup

CLI Building entry: {"bin":"src/bin.ts","index":"src/index.ts"}
CLI Using tsconfig: tsconfig.json
CLI tsup v8.5.1
CLI Using tsup config: /Users/eliot/Workspaces/OpenBook-wt-meet-1/packages/mcp/tsup.config.ts
CLI Target: node18
CLI Cleaning output folder
ESM Build start
ESM dist/chunk-N6662UMY.js     98.60 KB
ESM dist/index.js              136.00 B
ESM dist/bin.js                2.40 KB
ESM dist/chunk-N6662UMY.js.map 181.29 KB
ESM dist/bin.js.map            6.65 KB
ESM dist/index.js.map          71.00 B
ESM ⚡️ Build success in 11ms
DTS Build start
DTS ⚡️ Build success in 673ms
DTS dist/index.d.ts 1.84 KB

> @book.dev/server@3.17.0 build /Users/eliot/Workspaces/OpenBook-wt-meet-1/packages/server
> tsup

CLI Building entry: {"bin":"src/bin.ts","index":"src/index.ts","browser":"src/browser.ts"}
CLI Using tsconfig: tsconfig.json
CLI tsup v8.5.1
CLI Using tsup config: /Users/eliot/Workspaces/OpenBook-wt-meet-1/packages/server/tsup.config.ts
CLI Target: node18
CLI Cleaning output folder
ESM Build start
ESM dist/index.js              552.00 B
ESM dist/browser.js            30.24 KB
ESM dist/bin.js                215.00 B
ESM dist/chunk-Z5QDSVHR.js     415.58 KB
ESM dist/chunk-V6MBCKVR.js     422.16 KB
ESM dist/index.js.map          71.00 B
ESM dist/bin.js.map            556.00 B
ESM dist/browser.js.map        61.42 KB
ESM dist/chunk-V6MBCKVR.js.map 787.04 KB
ESM dist/chunk-Z5QDSVHR.js.map 1005.77 KB
ESM ⚡️ Build success in 42ms
DTS Build start
DTS ⚡️ Build success in 2136ms
DTS dist/index.d.ts        68.49 KB
DTS dist/browser.d.ts      13.43 KB
DTS dist/hub-CUJHMMTq.d.ts 136.66 KB

> open-book@0.0.0-workspace check:gen /Users/eliot/Workspaces/OpenBook-wt-meet-1
> pnpm --filter @book.dev/ui run check:gen


> @book.dev/ui@3.17.0 check:gen /Users/eliot/Workspaces/OpenBook-wt-meet-1/packages/ui
> pnpm run gen:bundled-plugins && (git diff --exit-code -- src/plugins/bundled.gen.ts src/export/ledgerFolds.gen || (echo 'Committed .gen mirror is STALE: run pnpm --filter @book.dev/ui run gen:bundled-plugins and commit the result.' >&2 && exit 1))


> @book.dev/ui@3.17.0 gen:bundled-plugins /Users/eliot/Workspaces/OpenBook-wt-meet-1/packages/ui
> node --import tsx scripts/bundlePlugins.ts

[bundlePlugins] OPENBOOK_REGISTRY_PRIVATE_KEY is unset — signing with the committed TEST-ONLY key (scripts/test-registry-key.json). Fine for dev/test; production builds must set the secret (docs/plugin-signing.md).
wrote src/plugins/bundled.gen.ts (1 plugin(s), signed by OpenBook Test Registry [test])
wrote src/export/ledgerFolds.gen (2 fold module(s))

> open-book@0.0.0-workspace typecheck /Users/eliot/Workspaces/OpenBook-wt-meet-1
> pnpm -r --if-present run typecheck

Scope: 6 of 7 workspace projects
packages/sdk typecheck$ tsc -p tsconfig.json --noEmit
packages/sdk typecheck: Done
packages/ui typecheck$ tsc --noEmit
packages/ui typecheck: Done
packages/app typecheck$ tsc --noEmit
packages/app typecheck: Done
packages/mcp typecheck$ tsc --noEmit
packages/server typecheck$ tsc --noEmit
packages/mcp typecheck: Done
packages/server typecheck: Done
packages/web typecheck$ tsc --noEmit
packages/web typecheck: Done

> open-book@0.0.0-workspace lint /Users/eliot/Workspaces/OpenBook-wt-meet-1
> pnpm -r run lint

Scope: 6 of 7 workspace projects
packages/sdk lint$ eslint .
packages/sdk lint: Done
packages/ui lint$ eslint . && pnpm run lint:css && pnpm run test:stylelint
packages/ui lint: > @book.dev/ui@3.17.0 lint:css /Users/eliot/Workspaces/OpenBook-wt-meet-1/packages/ui
packages/ui lint: > stylelint src/index.css
packages/ui lint: > @book.dev/ui@3.17.0 test:stylelint /Users/eliot/Workspaces/OpenBook-wt-meet-1/packages/ui
packages/ui lint: > node scripts/assert-spacing-stylelint.mjs
packages/ui lint: SPC-2 stylelint controls passed (2 positive, 4 negative)
packages/ui lint: Done
packages/app lint$ eslint .
packages/app lint: Done
packages/mcp lint$ eslint .
packages/server lint$ eslint .
packages/mcp lint: Done
packages/server lint: Done
packages/web lint$ eslint .
packages/web lint: Done

> open-book@0.0.0-workspace test /Users/eliot/Workspaces/OpenBook-wt-meet-1
> pnpm -r --if-present run test

Scope: 6 of 7 workspace projects
packages/sdk test$ vitest run
packages/sdk test:  RUN  v4.1.7 /Users/eliot/Workspaces/OpenBook-wt-meet-1/packages/sdk
packages/sdk test:  Test Files  32 passed (32)
packages/sdk test:       Tests  546 passed (546)
packages/sdk test:    Start at  21:47:29
packages/sdk test:    Duration  2.01s (transform 2.52s, setup 0ms, import 3.86s, tests 3.20s, environment 3ms)
packages/sdk test: Done
packages/ui test$ vitest run
packages/ui test:  RUN  v4.1.7 /Users/eliot/Workspaces/OpenBook-wt-meet-1/packages/ui
packages/ui test:  Test Files  244 passed (244)
packages/ui test:       Tests  2319 passed (2319)
packages/ui test:    Start at  21:47:31
packages/ui test:    Duration  44.12s (transform 20.81s, setup 0ms, import 150.57s, tests 100.48s, environment 95.13s)
packages/ui test: Done
packages/app test$ vitest run
packages/app test:  RUN  v4.1.7 /Users/eliot/Workspaces/OpenBook-wt-meet-1/packages/app
packages/app test:  Test Files  2 passed (2)
packages/app test:       Tests  7 passed (7)
packages/app test:    Start at  21:48:16
packages/app test:    Duration  3.30s (transform 2.15s, setup 0ms, import 2.97s, tests 66ms, environment 380ms)
packages/app test: Done
packages/mcp test$ node --import tsx scripts/listed.test.mts && tsx scripts/pages.test.mts && tsx scripts/suggestions.test.mts && tsx scripts/databases.test.mts && tsx scripts/assets.test.mts && tsx scripts/blocks.test.mts && tsx scripts/tables.test.mts && tsx scripts/forms.test.mts && tsx scripts/blockTypes.test.mts && tsx scripts/readme.test.mts && tsx scripts/endpoint.test.mts && tsx scripts/coverage.test.mts
packages/server test$ vitest run
packages/server test:  RUN  v4.1.7 /Users/eliot/Workspaces/OpenBook-wt-meet-1/packages/server
packages/mcp test: ✅ ALL 3 MCP LISTED CONTRACT CHECKS PASSED
packages/mcp test:   ✓ set_page_appearance applies in direct mode
packages/mcp test:   ✓ valid gradient id resolves to curated css
packages/mcp test:   ✓ read_page reflects persisted appearance
packages/mcp test:   ✓ move_page reparents a page
packages/mcp test:   ✓ list_pages exposes the new parent and order
packages/mcp test:   ✓ get/set page properties round-trip
packages/mcp test:   ✓ unknown page returns a typed safe error
packages/mcp test:   ✓ moving into an own subtree is refused
packages/mcp test:   ✓ invalid appearance enum is refused without path leakage
packages/mcp test:   ✓ arbitrary gradient css is refused
packages/mcp test:   ✓ http image cover is refused
packages/mcp test:   ✓ javascript image cover is refused
packages/mcp test:   ✓ https image cover is accepted
packages/mcp test:   ✓ OpenBook asset image cover is accepted
packages/mcp test:   ✓ computed/unknown property writes are typed refusals
packages/mcp test:   ✓ read-only instance refuses writes with a typed error
packages/mcp test:   ✓ read-only refusal leaves properties unchanged
packages/mcp test: ✅ ALL 17 API-10 PAGE TOOL CHECKS PASSED
packages/mcp test: OpenBook server up at http://127.0.0.1:4406
packages/mcp test: Resolved suggest (instance suggest, page inherit) — writes create suggestions
packages/mcp test:   ✓ upload_asset refuses suggest/read-only policy (bytes never become a suggestion)
packages/mcp test:   ✓ update_block returns a "Suggested for review" result
packages/mcp test:   ✓ update_block recorded exactly one suggestion
packages/mcp test:   ✓ suggestion kind maps update_block → replace-text
packages/mcp test:   ✓ suggestion is authored by the MCP client (authorKind ai)
packages/mcp test:   ✓ suggestion targets the block
packages/mcp test:   ✓ suggestion payload mirrors the agent (applyKind + before merge base)
packages/mcp test:   ✓ the page text was NOT mutated (still original)
packages/mcp test:   ✓ set_db_cell returns a "Suggested for review" result
packages/mcp test:   ✓ set_db_cell recorded a set-cell suggestion on the host page
packages/mcp test:   ✓ set-cell suggestion targets the db/row/property
packages/mcp test:   ✓ the database cell was NOT mutated
packages/mcp test:   ✓ all six API-9 database writes suggest under suggest policy
packages/mcp test:   ✓ create_database creates its host page immediately under suggest policy
packages/mcp test:   ✓ whitespace property name is refused under suggest policy
packages/mcp test:   ✓ describe_database remains a read under suggest policy
packages/mcp test:   ✓ suggested update/delete row did not mutate
packages/mcp test:   ✓ API-10 page writes suggest and get_page_properties remains a read
packages/mcp test:   ✓ suggested API-10 writes do not mutate
packages/mcp test:   ✓ create_page applies immediately (page exists)
packages/mcp test:   ✓ create_page recorded no suggestion
packages/mcp test: Resolved direct (instance policy = direct) — writes mutate directly
packages/mcp test:   ✓ all six API-9 database writes apply under direct policy
packages/mcp test:   ✓ whitespace property name is refused under direct policy
packages/mcp test:   ✓ direct delete_row moved the row to trash
packages/mcp test:   ✓ all four API-10 page tools succeed under direct policy
packages/mcp test:   ✓ upload_asset applies under direct policy
packages/mcp test:   ✓ update_block confirms a direct write
packages/mcp test:   ✓ the page text WAS mutated under instance=direct
packages/mcp test:   ✓ direct write recorded NO new suggestion
packages/mcp test: Page override (suggest) beats instance (direct)
packages/mcp test:   ✓ page suggest override → a suggestion despite instance direct
packages/mcp test:   ✓ page suggest override did NOT mutate
packages/mcp test:   ✓ page suggest override recorded a new suggestion
packages/mcp test: Page override (direct) beats instance (suggest)
packages/mcp test:   ✓ page direct override → a direct write despite instance suggest
packages/mcp test:   ✓ page direct override mutated the page
packages/mcp test:   ✓ page direct override recorded NO new suggestion
packages/mcp test: Retired OPENBOOK_MCP_ALLOW_DIRECT_EDITS — never enables direct, logs a deprecation
packages/mcp test:   ✓ env var set + policy suggest → still a suggestion
packages/mcp test:   ✓ env var did NOT force a direct write
packages/mcp test:   ✓ env var write recorded a suggestion (not a mutation)
packages/mcp test:   ✓ the connector logged a deprecation for the retired env var
packages/mcp test: Fail-safe: older server (agent-edits route absent) → suggest even under instance=direct
packages/mcp test:   ✓ policy fetch failing (404) → a suggestion, not a direct write
packages/mcp test:   ✓ fail-safe did NOT mutate despite instance=direct
packages/mcp test:   ✓ fail-safe recorded a suggestion
packages/mcp test:   ✓ all six API-9 database writes return typed refusals on a read-only instance
packages/mcp test:   ✓ API-10 writes refuse read-only while get_page_properties remains readable
packages/mcp test: ✅ ALL 44 CHECKS PASSED — MCP writes honor the resolved agent-edits policy per write (env grant retired).
packages/mcp test:   ✓ create_database returns page and database ids
packages/mcp test:   ✓ update_database returns the new name
packages/mcp test:   ✓ create_property returns text/number/select schemas
packages/mcp test:   ✓ update_property returns rename and replacement options
packages/mcp test:   ✓ update_row returns merged typed values
packages/mcp test:   ✓ describe_database returns schema and counts
packages/mcp test:   ✓ unknown database id is a typed error
packages/mcp test:   ✓ unknown property id is a typed error
packages/mcp test:   ✓ wrong property value is typed and leaks no paths
packages/mcp test:   ✓ delete_row soft-deletes to trash
packages/mcp test:   ✓ describeDatabaseTool is shared by agent and MCP
packages/mcp test:   ✓ createDatabaseTool is shared by agent and MCP
packages/mcp test:   ✓ updateDatabaseTool is shared by agent and MCP
packages/mcp test:   ✓ createPropertyTool is shared by agent and MCP
packages/mcp test:   ✓ updatePropertyTool is shared by agent and MCP
packages/mcp test:   ✓ updateRowTool is shared by agent and MCP
packages/mcp test:   ✓ deleteRowTool is shared by agent and MCP
packages/mcp test: ✅ ALL 17 CHECKS PASSED — API-9 database round-trip and negatives.
packages/mcp test:   ✓ oversize base64 is refused before decode or page lookup
packages/mcp test:   ✓ exactly 10 MiB passes the padding-aware pre-check
packages/mcp test:   ✓ 10 MiB plus one byte is refused by the padding-aware pre-check
packages/mcp test:   ✓ in-app agent refuses upload_asset without direct edit access
packages/mcp test:   ✓ in-app agent refuses upload_asset after external-tool taint
packages/mcp test:   ✓ PNG upload returns typed metadata without payload
packages/mcp test:   ✓ image block round-trips its uploaded assetId
packages/mcp test:   ✓ image alt and width update round-trip
packages/mcp test:   ✓ htmlArtifact round-trips its inert assetId
packages/mcp test:   ✓ disallowed MIME returns a typed error
packages/mcp test:   ✓ malformed base64 returns a typed error
packages/mcp test:   ✓ missing page returns a typed error
packages/mcp test:   ✓ suggest/read-only policy refuses immediate upload
packages/mcp test: 13 asset checks passed.
packages/mcp test: OpenBook server up at http://127.0.0.1:4411
packages/mcp test: API-1: tool catalogue exposes nested children + the new write tools
packages/mcp test: API-8: rich text inputs materialize as editor runs
packages/mcp test:   ✓ update_block parses mini-markdown into bold and link runs
packages/mcp test:   ✓ explicit runs round-trip exactly
packages/mcp test:   ✓ plain true keeps marker bytes literal
packages/mcp test:   ✓ unmarked strings preserve existing plain behavior
packages/mcp test:   ✓ the catalogue includes delete_block and update_block_props
packages/mcp test:   ✓ the catalogue includes move_block and insert_blocks
packages/mcp test:   ✓ append_blocks advertises a recursive `children` array in its JSON Schema
packages/mcp test:   ✓ append_blocks documents the table and columns shapes
packages/mcp test: API-1: a nested columns/group payload lands as a real tree
packages/mcp test:   ✓ append_blocks confirms a direct write and counts the nested blocks
packages/mcp test:   ✓ the tree contains columns → column → group → paragraph at increasing depth
packages/mcp test:   ✓ a nested kit input kept its props
packages/mcp test:   ✓ nested block ids are unique and addressable
packages/mcp test:   ✓ read_page projects the nested text
packages/mcp test: API-7: move_block and insert_blocks apply directly at precise positions
packages/mcp test:   ✓ move_block reparents directly using afterId
packages/mcp test:   ✓ insert_blocks accepts a nested payload at index
packages/mcp test:   ✓ direct move + insert produced B, nested insert, C inside the group
packages/mcp test: API-1: a table → row → cell payload lands as a 3×3 table
packages/mcp test:   ✓ the table has 3 rows and 9 cells nested under it
packages/mcp test:   ✓ every cell kept its text in payload order
packages/mcp test:   ✓ the header row kept its props
packages/mcp test:   ✓ move_block allows moving a whole table block
packages/mcp test:   ✓ move_block refuses moving table internals in favour of table_* tools
packages/mcp test: API-1: structural caps are refused with an actionable message
packages/mcp test:   ✓ a 9-level payload is refused (max 8) with an explicit depth error
packages/mcp test:   ✓ an 8-level payload (exactly at the cap) is accepted
packages/mcp test:   ✓ a 401-node payload is refused (max 400) counting nested children
packages/mcp test: API-1 (should-fix 1.1): the container parent/child contract is enforced (no silent drop)
packages/mcp test:   ✓ children on a non-container leaf are refused, naming the offending type
packages/mcp test:   ✓ a top-level row (no table parent) is refused — this is the wall-of-placeholders bug
packages/mcp test:   ✓ a cell directly under a table (skipping row) is refused
packages/mcp test:   ✓ NONE of the rejected structural payloads mutated the page
packages/mcp test: API-1 (should-fix 7.1/7.2): create_artifact_page accepts a NESTED payload and rejects a nested typo / bad structure
packages/mcp test:   ✓ create_artifact_page confirms creation of a nested layout
packages/mcp test:   ✓ create_artifact_page returned a new page id
packages/mcp test:   ✓ the artifact page materialized columns → column → group → paragraph
packages/mcp test:   ✓ create_artifact_page rejects a NESTED typo type, naming it
packages/mcp test:   ✓ create_artifact_page rejects a top-level row (same structural guard as append_blocks)
packages/mcp test: API-4 (direct): update_block_props merges shallowly and null removes a key
packages/mcp test:   ✓ update_block_props confirms a direct write on an image block
packages/mcp test:   ✓ the passed props were merged and the untouched ones survived
packages/mcp test:   ✓ a numeric image width is refused as mistyped
packages/mcp test:   ✓ update_block_props reaches a NESTED block (inside a group)
packages/mcp test:   ✓ an explicit null REMOVED the key (and did not store a null)
packages/mcp test:   ✓ the block text is untouched by a props update
packages/mcp test:   ✓ update_block_props on an unknown id is a clean error naming inspect_page_structure
packages/mcp test:   ✓ update_block_props with no props is refused
packages/mcp test:   ✓ update_block_props refuses the table `ord` key, pointing at the table tools
packages/mcp test:   ✓ update_block_props refuses the cell `col` key
packages/mcp test:   ✓ update_block_props refuses a `col:` column-registry key
packages/mcp test:   ✓ update_block_props refuses a `colbg:` column-tint key
packages/mcp test:   ✓ a refused table-key write left the block untouched
packages/mcp test: API-4 (direct): delete_block removes nested blocks, table rows, and whole containers
packages/mcp test:   ✓ delete_block removes a nested table ROW directly
packages/mcp test:   ✓ the row and its 3 cells are gone (subtree removed)
packages/mcp test:   ✓ the sibling rows survived
packages/mcp test:   ✓ delete_block removes a block nested inside a group
packages/mcp test:   ✓ delete_block removes a whole container
packages/mcp test:   ✓ only the image block remains
packages/mcp test:   ✓ delete_block on an unknown id is a clean error (nothing deleted)
packages/mcp test:   ✓ delete_block on an unknown page reports "Page not found"
packages/mcp test: API-4 (should-fix 4.1): deleting a table's last row/cell removes the table (keyed + legacy)
packages/mcp test:   ✓ deleting the last row of a KEYED table succeeds
packages/mcp test:   ✓ the keyed table is removed WHOLE, the sibling paragraph survives
packages/mcp test:   ✓ deleting the last row of a LEGACY table succeeds
packages/mcp test:   ✓ the legacy table is gone and the doc self-heals to one paragraph (never zero-root)
packages/mcp test:   ✓ deleting the only cell of the only row succeeds
packages/mcp test:   ✓ the 1×1 table is removed whole, the sibling paragraph survives
packages/mcp test: API-4 (should-fix 4.2): delete prunes empty containers and never leaves a zero-root doc
packages/mcp test:   ✓ deleting the only block in a column succeeds
packages/mcp test:   ✓ the emptied column is pruned and the single-column layout is unwrapped
packages/mcp test:   ✓ deleting a page's only block succeeds
packages/mcp test:   ✓ the page self-heals to exactly one paragraph
packages/mcp test: Policy gate: the new tools + nested payloads go through review under suggest
packages/mcp test:   ✓ a nested append under suggest is queued, not applied
packages/mcp test:   ✓ delete_block under suggest is queued, not applied
packages/mcp test:   ✓ update_block_props under suggest is queued, not applied
packages/mcp test:   ✓ move_block under suggest is queued, not applied
packages/mcp test:   ✓ insert_blocks under suggest keeps a nested payload
packages/mcp test:   ✓ five suggestions were recorded
packages/mcp test:   ✓ move_block uses the move review kind and insert_blocks reuses insert
packages/mcp test:   ✓ insert_blocks suggestion preserves recursive children
packages/mcp test:   ✓ the queued nested payload kept its children (3 rows × 3 cells)
packages/mcp test:   ✓ delete_block maps to the `delete` suggestion kind and targets the block
packages/mcp test:   ✓ update_block_props maps to `replace-text` with applyKind set_block_props (the bridge's patchBlock)
packages/mcp test:   ✓ both new suggestions are authored by the MCP client
packages/mcp test:   ✓ the diff card shows a before/after for each
packages/mcp test:   ✓ NOTHING was mutated under suggest (block still there, props unchanged)
packages/mcp test:   ✓ a cap violation errors under suggest too, queueing nothing
packages/mcp test:   ✓ insert_blocks enforces the same depth cap before queueing
packages/mcp test: ✅ ALL 80 CHECKS PASSED — nested children over MCP + delete_block / update_block_props.
packages/mcp test: OpenBook server up at http://127.0.0.1:4412
packages/mcp test: Catalogue: the twelve table tools are exposed with descriptions
packages/mcp test:   ✓ every table tool is registered
packages/mcp test:   ✓ each documents that coordinates are RENDER order
packages/mcp test:   ✓ table_insert_row documents the header-row refusal
packages/mcp test:   ✓ the delete tools document that the last row/column removes the table
packages/mcp test: A table built by append_blocks is immediately inspectable + operable
packages/mcp test:   ✓ inspect_table with no tableId lists the page's tables
packages/mcp test:   ✓ the table reads back 3×3 with a header row
packages/mcp test:   ✓ an append_blocks table has NO order keys yet (reported as unmigrated)
packages/mcp test:   ✓ cells are reported in payload order with addressable ids
packages/mcp test: The header-row invariant (the editor hides insert-above on row 0)
packages/mcp test:   ✓ inserting a row ABOVE the header row is refused with an explanation
packages/mcp test:   ✓ the refusal changed nothing
packages/mcp test: table_insert_row: the first op migrates col:/ord without reshuffling
packages/mcp test:   ✓ the insert reports a direct apply and the new size
packages/mcp test:   ✓ order keys are now assigned (migrated) with 3 columns
packages/mcp test:   ✓ the blank row landed at render position 1 and nothing else moved
packages/mcp test:   ✓ the stored projection really carries col:/ord props
packages/mcp test: table_set_cell by index and by cell id
packages/mcp test:   ✓ a cell id alone identifies the table AND the coordinates
packages/mcp test:   ✓ both addressing styles wrote the cells they meant
packages/mcp test: Columns: insert, move, tint, delete
packages/mcp test:   ✓ a column was inserted at render position 1 with a cell in every row
packages/mcp test:   ✓ table_move_column reports success
packages/mcp test:   ✓ the moved column is last and the others closed up
packages/mcp test:   ✓ a column tint is stored as colbg:<colId> on the table
packages/mcp test:   ✓ a column width is stored as colw:<colId> on the table
packages/mcp test:   ✓ deleting a column by id removes its cells everywhere
packages/mcp test:   ✓ the deleted column left no orphan colbg entry
packages/mcp test:   ✓ the deleted column left no orphan colw entry
packages/mcp test: Rows: duplicate, move (by id), tint, delete
packages/mcp test:   ✓ duplicate_row copies the row directly below with FRESH ids
packages/mcp test:   ✓ the duplicated cells are distinct blocks
packages/mcp test:   ✓ table_move_row addressed by row ID moved it to render position 1
packages/mcp test:   ✓ the header row stayed put
packages/mcp test:   ✓ a row tint is the row block's bg prop
packages/mcp test:   ✓ table_delete_row by id succeeds
packages/mcp test:   ✓ the row is gone and the rest kept their render order
packages/mcp test: Bounds + unknown-id errors are clean and actionable
packages/mcp test:   ✓ an out-of-range index names the table dimensions
packages/mcp test:   ✓ an unknown cell id points at inspect_table
packages/mcp test:   ✓ an unknown column id errors cleanly
packages/mcp test:   ✓ an unknown tableId errors cleanly
packages/mcp test:   ✓ omitting every way of naming the table is refused
packages/mcp test:   ✓ a move target past the axis (counted with the row removed) is refused
packages/mcp test:   ✓ every refusal left the table exactly as it was
packages/mcp test: A table cell also answers to the generic block tools (no regression)
packages/mcp test:   ✓ update_block can still write a cell by its block id
packages/mcp test: The last row / column removes the WHOLE table (editor parity)
packages/mcp test:   ✓ deleting the last row says the whole table block was removed
packages/mcp test:   ✓ the table really is gone from the page
packages/mcp test: Policy gate: every table op queues a reviewable table-op suggestion
packages/mcp test:   ✓ table_insert_row under suggest is queued, not applied
packages/mcp test:   ✓ all five ops were queued
packages/mcp test:   ✓ every one reviews as the `table-op` suggestion kind anchored on the TABLE block
packages/mcp test:   ✓ each payload carries the bridge applyKind = the tool name
packages/mcp test:   ✓ payloads carry the page, the table, and RESOLVED sorted coordinates
packages/mcp test:   ✓ a node-targeting op also carries the STABLE id it resolved to (survives a reorder in review)
packages/mcp test:   ✓ a cell op carries the cell id and a before→after for the diff card
packages/mcp test:   ✓ authorship is the MCP client
packages/mcp test:   ✓ NOTHING was mutated under suggest — same grid, still unmigrated
packages/mcp test:   ✓ the header guard bites under suggest too, queueing nothing
packages/mcp test:   ✓ bounds are validated BEFORE the policy branch
packages/mcp test: An accepted suggestion applies IDENTICALLY to a direct write
packages/mcp test:   ✓ replaying the queued payload yields the same grid as the direct write
packages/mcp test:   ✓ …and it really moved something
packages/mcp test: ✅ ALL 54 CHECKS PASSED — table structure tools over MCP (API-3).
packages/mcp test: FORM-7 read tools + capability redaction
packages/mcp test:   ✓ list_forms recursively finds the nested form
packages/mcp test:   ✓ list_forms returns summary fields and the database binding
packages/mcp test:   ✓ list_forms never returns either submission key
packages/mcp test:   ✓ get_form_schema returns the fields plus enabled/databaseId
packages/mcp test:   ✓ get_form_schema recursively redacts the capability
packages/mcp test:   ✓ inspect_page_structure still shows the nested form
packages/mcp test:   ✓ inspect_page_structure redacts both key copies
packages/mcp test: FORM-7 update_block_props capability guard
packages/mcp test:   ✓ update_block_props refuses a top-level submissionKey write
packages/mcp test:   ✓ update_block_props refuses a nested schema.submissionKey smuggle
packages/mcp test:   ✓ both refused probes leave both stored key copies unchanged
packages/mcp test:   ✓ update_block_props still applies harmless form props directly
packages/mcp test:   ✓ the merged-props success echo contains no submission key bytes
packages/mcp test: FORM-7 list_form_submissions filtering + cursor
packages/mcp test:   ✓ list_form_submissions returns one marked row and a cursor
packages/mcp test:   ✓ pagination returns exactly the two rows marked for this form
packages/mcp test:   ✓ the last submissions page omits nextCursor
packages/mcp test:   ✓ a cursor from outside the filtered form is rejected
packages/mcp test:   ✓ a database hosted by another page is rejected
packages/mcp test:   ✓ a schema-only database binding is not authoritative
packages/mcp test: FORM-7 strict field-op schemas + suggest mode
packages/mcp test:   ✓ zod rejects an unknown field kind before the handler
packages/mcp test:   ✓ zod rejects an empty update patch
packages/mcp test:   ✓ zod rejects an unknown operation discriminator
packages/mcp test:   ✓ zod rejects a non-http(s) confirmation redirect
packages/mcp test:   ✓ update_form_field queues a suggestion on a suggest page
packages/mcp test:   ✓ suggest-mode update_form_field leaves the block unchanged
packages/mcp test:   ✓ the field suggestion targets the form block through set_block_props
packages/mcp test:   ✓ the suggestion preserves the submission capability without exposing it in the tool result
packages/mcp test:   ✓ set_form_settings also queues through the suggest policy
packages/mcp test:   ✓ suggest-mode set_form_settings leaves settings unchanged
packages/mcp test: FORM-7 direct field operations + settings
packages/mcp test:   ✓ add applies directly on a direct page with a 43-character key
packages/mcp test:   ✓ update applies directly
packages/mcp test:   ✓ reorder applies directly
packages/mcp test:   ✓ remove applies directly
packages/mcp test:   ✓ all direct operations landed in final order with the patch
packages/mcp test:   ✓ direct field edits preserve both 43-character key copies
packages/mcp test:   ✓ set_form_settings applies directly
packages/mcp test:   ✓ settings synchronize outer gate props and nested schema
packages/mcp test:   ✓ settings carry label/confirmation and accept maxSubmissions=0
packages/mcp test:   ✓ set_form_settings cannot rotate or corrupt the key
packages/mcp test:   ✓ nullable settings clear optional values directly
packages/mcp test:   ✓ cleared settings are removed rather than stored as null
packages/mcp test: ✅ ALL 40 CHECKS PASSED — FORM-7 tools, policy handling, pagination, validation, and key redaction verified.
packages/mcp test: OpenBook server up at http://127.0.0.1:4414
packages/mcp test: API-2: the tool catalogue exposes list_block_types
packages/mcp test:   ✓ list_block_types is registered
packages/mcp test:   ✓ create_artifact_page advertises catalogue types in its schema (generated, not hand-written)
packages/mcp test: API-2: EVERY catalogued type is creatable via create_artifact_page (coverage)
packages/mcp test:   ✓ one artifact page holding every catalogued type is accepted
packages/mcp test:   ✓ stored page contains a "paragraph" block
packages/mcp test:   ✓ stored page contains a "heading" block
packages/mcp test:   ✓ stored page contains a "list" block
packages/mcp test:   ✓ stored page contains a "todo" block
packages/mcp test:   ✓ stored page contains a "quote" block
packages/mcp test:   ✓ stored page contains a "callout" block
packages/mcp test:   ✓ stored page contains a "code" block
packages/mcp test:   ✓ stored page contains a "notes" block
packages/mcp test:   ✓ stored page contains a "divider" block
packages/mcp test:   ✓ stored page contains a "image" block
packages/mcp test:   ✓ stored page contains a "htmlArtifact" block
packages/mcp test:   ✓ stored page contains a "columns" block
packages/mcp test:   ✓ stored page contains a "column" block
packages/mcp test:   ✓ stored page contains a "table" block
packages/mcp test:   ✓ stored page contains a "row" block
packages/mcp test:   ✓ stored page contains a "cell" block
packages/mcp test:   ✓ stored page contains a "group" block
packages/mcp test:   ✓ stored page contains a "tabs" block
packages/mcp test:   ✓ stored page contains a "tab" block
packages/mcp test:   ✓ stored page contains a "accordion" block
packages/mcp test:   ✓ stored page contains a "accordionsection" block
packages/mcp test:   ✓ stored page contains a "slider" block
packages/mcp test:   ✓ stored page contains a "number" block
packages/mcp test:   ✓ stored page contains a "textfield" block
packages/mcp test:   ✓ stored page contains a "longtext" block
packages/mcp test:   ✓ stored page contains a "richtext" block
packages/mcp test:   ✓ stored page contains a "toggle" block
packages/mcp test:   ✓ stored page contains a "radio" block
packages/mcp test:   ✓ stored page contains a "dropdown" block
packages/mcp test:   ✓ stored page contains a "checklist" block
packages/mcp test:   ✓ stored page contains a "choicecards" block
packages/mcp test:   ✓ stored page contains a "searchselect" block
packages/mcp test:   ✓ stored page contains a "tagfield" block
packages/mcp test:   ✓ stored page contains a "location" block
packages/mcp test:   ✓ stored page contains a "actionbutton" block
packages/mcp test:   ✓ stored page contains a "kitchart" block
packages/mcp test:   ✓ stored page contains a "statuslight" block
packages/mcp test:   ✓ stored page contains a "progressbar" block
packages/mcp test:   ✓ stored page contains a "formula" block
packages/mcp test:   ✓ stored page contains a "linkcard" block
packages/mcp test:   ✓ stored page contains a "tooltipcard" block
packages/mcp test:   ✓ stored page contains a "dbview" block
packages/mcp test:   ✓ stored page contains a "dbform" block
packages/mcp test:   ✓ stored page contains a "form" block
packages/mcp test: API-2: unknown types are refused with a pointer at list_block_types
packages/mcp test:   ✓ a typo'd type is refused naming the type
packages/mcp test:   ✓ the refusal points at list_block_types
packages/mcp test: API-2: the table cell-count rule holds on both write paths
packages/mcp test:   ✓ create_artifact_page refuses a ragged table
packages/mcp test:   ✓ append_blocks refuses a ragged table
packages/mcp test: API-2: update_block_props validates declared prop VALUE types
packages/mcp test:   ✓ a declared prop with the wrong value type is refused, naming prop and expectation
packages/mcp test:   ✓ an invalid structured option is refused with a typed error naming opts
packages/mcp test: API-2: plugin block types — rejected while uninstalled, accepted once installed
packages/mcp test:   ✓ an uninstalled plugin's type is refused as not installed
packages/mcp test:   ✓ list_block_types lists every catalogued core + kit type
packages/mcp test:   ✓ with no plugins installed, pluginBlocks is empty
packages/mcp test:   ✓ list_block_types filters its payload to requested types
packages/mcp test:   ✓ after installing the bundled ledger plugin, its declared blocks are listed
packages/mcp test:   ✓ plugin entries carry a description
packages/mcp test:   ✓ the installed plugin's namespaced type is now accepted
packages/mcp test: All 60 checks passed.
packages/mcp test: ✅ README covers all 50 registered MCP tools and agent reference sections
packages/mcp test: OpenBook sidecar up (socket + TCP) at http://127.0.0.1:4409
packages/mcp test:   ✓ the server advertises a stable instanceId
packages/mcp test:   ✓ the foreign server has a DIFFERENT instanceId
packages/mcp test: Happy path: connector over the unified endpoint lists the SAME pages
packages/mcp test:   ✓ connector lists the page the server API shows
packages/mcp test:   ✓ list_pages inherits the client list filter (no MCP-side reimplementation)
packages/mcp test:   ✓ search_notes inherits the client search filter
packages/mcp test:   ✓ an unlisted page remains directly readable
packages/mcp test: Refusal: foreign responder on the target endpoint
packages/mcp test:   ✓ connector exits non-zero on an identity mismatch
packages/mcp test:   ✓ the error names the mismatch (never silently adopts the foreign server)
packages/mcp test: Refusal: nothing listening on the target port
packages/mcp test:   ✓ connector exits non-zero when the endpoint is unreachable
packages/mcp test:   ✓ the error is a clear reachability message
packages/mcp test: ✅ ALL 10 CHECKS PASSED — unified endpoint + instance verification.
packages/mcp test:   ✓ paragraph
packages/mcp test:   ✓ heading
packages/mcp test:   ✓ list
packages/mcp test:   ✓ todo
packages/mcp test:   ✓ quote
packages/mcp test:   ✓ callout
packages/mcp test:   ✓ code
packages/mcp test:   ✓ notes
packages/mcp test:   ✓ divider
packages/mcp test:   ✓ image
packages/mcp test:   ✓ htmlArtifact
packages/mcp test:   ✓ columns
packages/mcp test:   ✓ column
packages/mcp test:   ✓ table
packages/mcp test:   ✓ row
packages/mcp test:   ✓ cell
packages/mcp test:   ✓ group
packages/mcp test:   ✓ tabs
packages/mcp test:   ✓ tab
packages/mcp test:   ✓ accordion
packages/mcp test:   ✓ accordionsection
packages/mcp test:   ✓ slider
packages/mcp test:   ✓ number
packages/mcp test:   ✓ textfield
packages/mcp test:   ✓ longtext
packages/mcp test:   ✓ richtext
packages/mcp test:   ✓ toggle
packages/mcp test:   ✓ radio
packages/mcp test:   ✓ dropdown
packages/mcp test:   ✓ checklist
packages/mcp test:   ✓ choicecards
packages/mcp test:   ✓ searchselect
packages/mcp test:   ✓ tagfield
packages/mcp test:   ✓ location
packages/mcp test:   ✓ actionbutton
packages/mcp test:   ✓ kitchart
packages/mcp test:   ✓ statuslight
packages/mcp test:   ✓ progressbar
packages/mcp test:   ✓ formula
packages/mcp test:   ✓ linkcard
packages/mcp test:   ✓ tooltipcard
packages/mcp test:   ✓ dbview
packages/mcp test:   ✓ dbform
packages/mcp test:   ✓ form
packages/mcp test:   ✓ openbook.ledger/journal-entry
packages/mcp test:   ✓ openbook.ledger/trial-balance
packages/mcp test:   ✓ openbook.ledger/account-register
packages/mcp test:   ✓ openbook.ledger/bank-import
packages/mcp test:   ✓ openbook.ledger/reconcile
packages/mcp test:   ✓ openbook.ledger/balance-sheet
packages/mcp test:   ✓ openbook.ledger/income-statement
packages/mcp test:   ✓ openbook.ledger/period-close
packages/mcp test:   ✓ openbook.ledger/beancount-export
packages/mcp test: All 44 catalogue types + 9 plugin blocks have MCP API coverage; exemptions: none.
packages/mcp test: Done
packages/server test:  ❯ src/ableOidc.test.ts (22 tests | 1 failed) 82811ms
packages/server test:      × uses last-good discovery while offline and exempts both routes from access/guest/PAT gates 3946ms
packages/server test:  ❯ src/mirror.integration.test.ts (3 tests | 1 failed) 18588ms
packages/server test:      × mirrors live edits, syncs multiple clients, re-imports external edits, and resolves conflicts DB-wins 11316ms
packages/server test: Failed
/Users/eliot/Workspaces/OpenBook-wt-meet-1/packages/server:
 ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL  @book.dev/server@3.17.0 test: `vitest run`
Exit status 130
 ELIFECYCLE  Test failed. See above for more details.
 ELIFECYCLE  Command failed with exit code 130.

```

</details>

<details>
<summary>Unsandboxed pnpm verify (SDK property-test timeout; exit 1)</summary>

```text

> open-book@0.0.0-workspace verify /Users/eliot/Workspaces/OpenBook-wt-meet-1
> pnpm run test:eslint-rules && pnpm run build:libs && pnpm run check:gen && pnpm run typecheck && pnpm run lint && pnpm run test && pnpm run test:e2e


> open-book@0.0.0-workspace test:eslint-rules /Users/eliot/Workspaces/OpenBook-wt-meet-1
> node --test eslint-rules/*.test.mjs

✔ allows spacing-scale utilities and non-spacing arbitrary values (260.361375ms)
✔ flags arbitrary padding, margin, and gap values in className (104.49275ms)
✔ checks nested, template, and conventionally named hoisted class strings (8.074959ms)
✔ allows paint-only hover changes and non-hover geometry (281.659458ms)
✔ flags every guarded hover-geometry utility family (241.359375ms)
✔ flags display swaps in either class ordering and nested class strings (33.757792ms)
ℹ tests 6
ℹ suites 0
ℹ pass 6
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2950.026541

> open-book@0.0.0-workspace build:libs /Users/eliot/Workspaces/OpenBook-wt-meet-1
> pnpm --filter @book.dev/sdk run build && pnpm --filter @book.dev/ui run build && pnpm --filter @book.dev/mcp run build && pnpm --filter @book.dev/server run build


> @book.dev/sdk@3.17.0 build /Users/eliot/Workspaces/OpenBook-wt-meet-1/packages/sdk
> tsc -p tsconfig.build.json


> @book.dev/ui@3.17.0 build /Users/eliot/Workspaces/OpenBook-wt-meet-1/packages/ui
> pnpm run gen:bundled-plugins && pnpm run build:viewer && vite build && tsc


> @book.dev/ui@3.17.0 gen:bundled-plugins /Users/eliot/Workspaces/OpenBook-wt-meet-1/packages/ui
> node --import tsx scripts/bundlePlugins.ts

[bundlePlugins] OPENBOOK_REGISTRY_PRIVATE_KEY is unset — signing with the committed TEST-ONLY key (scripts/test-registry-key.json). Fine for dev/test; production builds must set the secret (docs/plugin-signing.md).
wrote src/plugins/bundled.gen.ts (1 plugin(s), signed by OpenBook Test Registry [test])
wrote src/export/ledgerFolds.gen (2 fold module(s))

> @book.dev/ui@3.17.0 build:viewer /Users/eliot/Workspaces/OpenBook-wt-meet-1/packages/ui
> vite build --config vite.viewer.config.js

vite v8.0.14 building client environment for production...
[2K
transforming...✓ 2076 modules transformed.
rendering chunks...
computing gzip size...
src/export/vendor/openbook-viewer.js  1,727.92 kB │ gzip: 486.47 kB

✓ built in 5.76s
vite v8.0.14 building client environment for production...
[2K
transforming...[PLUGIN_TIMINGS] Your build spent significant time in plugin `vite:worker`. See https://rolldown.rs/options/checks#plugintimings for more details.

✓ 356 modules transformed.
rendering chunks...
computing gzip size...
dist/style.css                         190.24 kB │ gzip:  31.11 kB
dist/rolldown-runtime-Dy4uBu1J.js        0.24 kB │ gzip:   0.21 kB
dist/emoji-Bmft6RPl.js                   0.30 kB │ gzip:   0.23 kB
dist/databaseMapLeaflet-8LYcHcR6.js      2.70 kB │ gzip:   1.37 kB
dist/pageCover-DG_o7L9m.js               3.06 kB │ gzip:   1.27 kB
dist/chartData-DQo78QVa.js               3.41 kB │ gzip:   1.44 kB
dist/exportSite-BhXgGHTe.js              5.19 kB │ gzip:   2.14 kB
dist/toPdf-DYGZU1B5.js                   5.94 kB │ gzip:   2.52 kB
dist/themes-CDtwgOr5.js                  9.86 kB │ gzip:   2.99 kB
dist/quickjsVm-BLKBOeOk.js              10.75 kB │ gzip:   3.58 kB
dist/EmojiGrid-wB896zFy.js              10.84 kB │ gzip:   4.36 kB
dist/exportBlocks-CNF_rL3d.js           36.70 kB │ gzip:  10.00 kB
dist/lucideIcons-DzkS5mW9.js            83.10 kB │ gzip:  25.98 kB
dist/pageIcon-Dn-g2w6N.js              355.97 kB │ gzip: 110.27 kB
dist/scope-DjPmYdi5.js                 786.80 kB │ gzip: 329.50 kB
dist/openbook-viewer-DleN9qK4.js     1,738.48 kB │ gzip: 487.23 kB
dist/index.js                        2,962.77 kB │ gzip: 813.80 kB

[INEFFECTIVE_DYNAMIC_IMPORT] src/plugins/index.ts is dynamically imported by src/screens/BlockPageDocument.tsx but also statically imported by src/blockeditor/MissingPluginBlock.tsx, src/components/ExtensionsSettings.tsx, src/components/PluginBoot.tsx, src/components/useAppCommands.ts, src/screens/BlockPageDocument.tsx, dynamic import will not move module into another chunk.

[INEFFECTIVE_DYNAMIC_IMPORT] src/export/toHtml.ts is dynamically imported by src/screens/BlockPageDocument.tsx but also statically imported by src/index.ts, dynamic import will not move module into another chunk.

✓ built in 6.65s

> @book.dev/mcp@3.17.0 build /Users/eliot/Workspaces/OpenBook-wt-meet-1/packages/mcp
> tsup

CLI Building entry: {"bin":"src/bin.ts","index":"src/index.ts"}
CLI Using tsconfig: tsconfig.json
CLI tsup v8.5.1
CLI Using tsup config: /Users/eliot/Workspaces/OpenBook-wt-meet-1/packages/mcp/tsup.config.ts
CLI Target: node18
CLI Cleaning output folder
ESM Build start
ESM dist/bin.js                2.40 KB
ESM dist/index.js              136.00 B
ESM dist/chunk-N6662UMY.js     98.60 KB
ESM dist/index.js.map          71.00 B
ESM dist/bin.js.map            6.65 KB
ESM dist/chunk-N6662UMY.js.map 181.29 KB
ESM ⚡️ Build success in 103ms
DTS Build start
DTS ⚡️ Build success in 6416ms
DTS dist/index.d.ts 1.84 KB

> @book.dev/server@3.17.0 build /Users/eliot/Workspaces/OpenBook-wt-meet-1/packages/server
> tsup

CLI Building entry: {"bin":"src/bin.ts","index":"src/index.ts","browser":"src/browser.ts"}
CLI Using tsconfig: tsconfig.json
CLI tsup v8.5.1
CLI Using tsup config: /Users/eliot/Workspaces/OpenBook-wt-meet-1/packages/server/tsup.config.ts
CLI Target: node18
CLI Cleaning output folder
ESM Build start
ESM dist/index.js              552.00 B
ESM dist/bin.js                215.00 B
ESM dist/chunk-Z5QDSVHR.js     415.58 KB
ESM dist/chunk-V6MBCKVR.js     422.16 KB
ESM dist/browser.js            30.24 KB
ESM dist/bin.js.map            556.00 B
ESM dist/index.js.map          71.00 B
ESM dist/browser.js.map        61.42 KB
ESM dist/chunk-V6MBCKVR.js.map 787.04 KB
ESM dist/chunk-Z5QDSVHR.js.map 1005.77 KB
ESM ⚡️ Build success in 432ms
DTS Build start
DTS ⚡️ Build success in 25736ms
DTS dist/index.d.ts        68.49 KB
DTS dist/browser.d.ts      13.43 KB
DTS dist/hub-CUJHMMTq.d.ts 136.66 KB

> open-book@0.0.0-workspace check:gen /Users/eliot/Workspaces/OpenBook-wt-meet-1
> pnpm --filter @book.dev/ui run check:gen


> @book.dev/ui@3.17.0 check:gen /Users/eliot/Workspaces/OpenBook-wt-meet-1/packages/ui
> pnpm run gen:bundled-plugins && (git diff --exit-code -- src/plugins/bundled.gen.ts src/export/ledgerFolds.gen || (echo 'Committed .gen mirror is STALE: run pnpm --filter @book.dev/ui run gen:bundled-plugins and commit the result.' >&2 && exit 1))


> @book.dev/ui@3.17.0 gen:bundled-plugins /Users/eliot/Workspaces/OpenBook-wt-meet-1/packages/ui
> node --import tsx scripts/bundlePlugins.ts

[bundlePlugins] OPENBOOK_REGISTRY_PRIVATE_KEY is unset — signing with the committed TEST-ONLY key (scripts/test-registry-key.json). Fine for dev/test; production builds must set the secret (docs/plugin-signing.md).
wrote src/plugins/bundled.gen.ts (1 plugin(s), signed by OpenBook Test Registry [test])
wrote src/export/ledgerFolds.gen (2 fold module(s))

> open-book@0.0.0-workspace typecheck /Users/eliot/Workspaces/OpenBook-wt-meet-1
> pnpm -r --if-present run typecheck

Scope: 6 of 7 workspace projects
packages/sdk typecheck$ tsc -p tsconfig.json --noEmit
packages/sdk typecheck: Done
packages/ui typecheck$ tsc --noEmit
packages/ui typecheck: Done
packages/app typecheck$ tsc --noEmit
packages/app typecheck: Done
packages/mcp typecheck$ tsc --noEmit
packages/server typecheck$ tsc --noEmit
packages/mcp typecheck: Done
packages/server typecheck: Done
packages/web typecheck$ tsc --noEmit
packages/web typecheck: Done

> open-book@0.0.0-workspace lint /Users/eliot/Workspaces/OpenBook-wt-meet-1
> pnpm -r run lint

Scope: 6 of 7 workspace projects
packages/sdk lint$ eslint .
packages/sdk lint: Done
packages/ui lint$ eslint . && pnpm run lint:css && pnpm run test:stylelint
packages/ui lint: > @book.dev/ui@3.17.0 lint:css /Users/eliot/Workspaces/OpenBook-wt-meet-1/packages/ui
packages/ui lint: > stylelint src/index.css
packages/ui lint: > @book.dev/ui@3.17.0 test:stylelint /Users/eliot/Workspaces/OpenBook-wt-meet-1/packages/ui
packages/ui lint: > node scripts/assert-spacing-stylelint.mjs
packages/ui lint: SPC-2 stylelint controls passed (2 positive, 4 negative)
packages/ui lint: Done
packages/app lint$ eslint .
packages/app lint: Done
packages/mcp lint$ eslint .
packages/server lint$ eslint .
packages/mcp lint: Done
packages/server lint: Done
packages/web lint$ eslint .
packages/web lint: Done

> open-book@0.0.0-workspace test /Users/eliot/Workspaces/OpenBook-wt-meet-1
> pnpm -r --if-present run test

Scope: 6 of 7 workspace projects
packages/sdk test$ vitest run
packages/sdk test:  RUN  v4.1.7 /Users/eliot/Workspaces/OpenBook-wt-meet-1/packages/sdk
packages/sdk test:  ❯ src/money.test.ts (27 tests | 1 failed) 7156ms
packages/sdk test:      × round-trips 1e6 seeded random amounts with zero drift 6046ms
packages/sdk test: ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
packages/sdk test:  FAIL  src/money.test.ts > parse ↔ format round-trip (property) > round-trips 1e6 seeded random amounts with zero drift
packages/sdk test: Error: Test timed out in 5000ms.
packages/sdk test: If this is a long-running test, pass a timeout value as the last argument or configure it globally with "testTimeout".
packages/sdk test:  ❯ src/money.test.ts:38:3
packages/sdk test:      36|
packages/sdk test:      37| describe('parse ↔ format round-trip (property)', () => {
packages/sdk test:      38|   it('round-trips 1e6 seeded random amounts with zero drift', () => {
packages/sdk test:        |   ^
packages/sdk test:      39|     const rand = mulberry32(0x1ed6e12);
packages/sdk test:      40|     // Deterministic edges first: zero, ±unit, boundary-of-grouping, n…
packages/sdk test: ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
packages/sdk test:  Test Files  1 failed | 31 passed (32)
packages/sdk test:       Tests  1 failed | 545 passed (546)
packages/sdk test:    Start at  23:07:57
packages/sdk test:    Duration  8.62s (transform 10.81s, setup 0ms, import 16.65s, tests 12.01s, environment 42ms)
packages/sdk test: Failed
/Users/eliot/Workspaces/OpenBook-wt-meet-1/packages/sdk:
 ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL  @book.dev/sdk@3.17.0 test: `vitest run`
Exit status 1
 ELIFECYCLE  Test failed. See above for more details.
 ELIFECYCLE  Command failed with exit code 1.

```

</details>

<details>
<summary>One-worker unsandboxed pnpm verify (UI lint-stage process exit during low disk space; exit 1)</summary>

```text

> open-book@0.0.0-workspace verify /Users/eliot/Workspaces/OpenBook-wt-meet-1
> pnpm run test:eslint-rules && pnpm run build:libs && pnpm run check:gen && pnpm run typecheck && pnpm run lint && pnpm run test && pnpm run test:e2e


> open-book@0.0.0-workspace test:eslint-rules /Users/eliot/Workspaces/OpenBook-wt-meet-1
> node --test eslint-rules/*.test.mjs

✔ allows spacing-scale utilities and non-spacing arbitrary values (342.133917ms)
✔ flags arbitrary padding, margin, and gap values in className (169.646708ms)
✔ checks nested, template, and conventionally named hoisted class strings (52.958584ms)
✔ allows paint-only hover changes and non-hover geometry (244.081333ms)
✔ flags every guarded hover-geometry utility family (190.840042ms)
✔ flags display swaps in either class ordering and nested class strings (77.12425ms)
ℹ tests 6
ℹ suites 0
ℹ pass 6
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2477.402459

> open-book@0.0.0-workspace build:libs /Users/eliot/Workspaces/OpenBook-wt-meet-1
> pnpm --filter @book.dev/sdk run build && pnpm --filter @book.dev/ui run build && pnpm --filter @book.dev/mcp run build && pnpm --filter @book.dev/server run build


> @book.dev/sdk@3.17.0 build /Users/eliot/Workspaces/OpenBook-wt-meet-1/packages/sdk
> tsc -p tsconfig.build.json


> @book.dev/ui@3.17.0 build /Users/eliot/Workspaces/OpenBook-wt-meet-1/packages/ui
> pnpm run gen:bundled-plugins && pnpm run build:viewer && vite build && tsc


> @book.dev/ui@3.17.0 gen:bundled-plugins /Users/eliot/Workspaces/OpenBook-wt-meet-1/packages/ui
> node --import tsx scripts/bundlePlugins.ts

[bundlePlugins] OPENBOOK_REGISTRY_PRIVATE_KEY is unset — signing with the committed TEST-ONLY key (scripts/test-registry-key.json). Fine for dev/test; production builds must set the secret (docs/plugin-signing.md).
wrote src/plugins/bundled.gen.ts (1 plugin(s), signed by OpenBook Test Registry [test])
wrote src/export/ledgerFolds.gen (2 fold module(s))

> @book.dev/ui@3.17.0 build:viewer /Users/eliot/Workspaces/OpenBook-wt-meet-1/packages/ui
> vite build --config vite.viewer.config.js

vite v8.0.14 building client environment for production...
[2K
transforming...✓ 2076 modules transformed.
rendering chunks...
computing gzip size...
src/export/vendor/openbook-viewer.js  1,727.92 kB │ gzip: 486.47 kB

✓ built in 2.88s
vite v8.0.14 building client environment for production...
[2K
transforming...✓ 356 modules transformed.
rendering chunks...
computing gzip size...
dist/style.css                         190.24 kB │ gzip:  31.11 kB
dist/rolldown-runtime-Dy4uBu1J.js        0.24 kB │ gzip:   0.21 kB
dist/emoji-Bmft6RPl.js                   0.30 kB │ gzip:   0.23 kB
dist/databaseMapLeaflet-8LYcHcR6.js      2.70 kB │ gzip:   1.37 kB
dist/pageCover-DG_o7L9m.js               3.06 kB │ gzip:   1.27 kB
dist/chartData-DQo78QVa.js               3.41 kB │ gzip:   1.44 kB
dist/exportSite-BhXgGHTe.js              5.19 kB │ gzip:   2.14 kB
dist/toPdf-DYGZU1B5.js                   5.94 kB │ gzip:   2.52 kB
dist/themes-CDtwgOr5.js                  9.86 kB │ gzip:   2.99 kB
dist/quickjsVm-BLKBOeOk.js              10.75 kB │ gzip:   3.58 kB
dist/EmojiGrid-wB896zFy.js              10.84 kB │ gzip:   4.36 kB
dist/exportBlocks-CNF_rL3d.js           36.70 kB │ gzip:  10.00 kB
dist/lucideIcons-DzkS5mW9.js            83.10 kB │ gzip:  25.98 kB
dist/pageIcon-Dn-g2w6N.js              355.97 kB │ gzip: 110.27 kB
dist/scope-DjPmYdi5.js                 786.80 kB │ gzip: 329.50 kB
dist/openbook-viewer-DleN9qK4.js     1,738.48 kB │ gzip: 487.23 kB
dist/index.js                        2,962.77 kB │ gzip: 813.80 kB

[INEFFECTIVE_DYNAMIC_IMPORT] src/plugins/index.ts is dynamically imported by src/screens/BlockPageDocument.tsx but also statically imported by src/blockeditor/MissingPluginBlock.tsx, src/components/ExtensionsSettings.tsx, src/components/PluginBoot.tsx, src/components/useAppCommands.ts, src/screens/BlockPageDocument.tsx, dynamic import will not move module into another chunk.

[INEFFECTIVE_DYNAMIC_IMPORT] src/export/toHtml.ts is dynamically imported by src/screens/BlockPageDocument.tsx but also statically imported by src/index.ts, dynamic import will not move module into another chunk.

✓ built in 2.91s

> @book.dev/mcp@3.17.0 build /Users/eliot/Workspaces/OpenBook-wt-meet-1/packages/mcp
> tsup

CLI Building entry: {"bin":"src/bin.ts","index":"src/index.ts"}
CLI Using tsconfig: tsconfig.json
CLI tsup v8.5.1
CLI Using tsup config: /Users/eliot/Workspaces/OpenBook-wt-meet-1/packages/mcp/tsup.config.ts
CLI Target: node18
CLI Cleaning output folder
ESM Build start
ESM dist/bin.js                2.40 KB
ESM dist/index.js              136.00 B
ESM dist/chunk-N6662UMY.js     98.60 KB
ESM dist/index.js.map          71.00 B
ESM dist/bin.js.map            6.65 KB
ESM dist/chunk-N6662UMY.js.map 181.29 KB
ESM ⚡️ Build success in 65ms
DTS Build start
DTS ⚡️ Build success in 3852ms
DTS dist/index.d.ts 1.84 KB

> @book.dev/server@3.17.0 build /Users/eliot/Workspaces/OpenBook-wt-meet-1/packages/server
> tsup

CLI Building entry: {"bin":"src/bin.ts","index":"src/index.ts","browser":"src/browser.ts"}
CLI Using tsconfig: tsconfig.json
CLI tsup v8.5.1
CLI Using tsup config: /Users/eliot/Workspaces/OpenBook-wt-meet-1/packages/server/tsup.config.ts
CLI Target: node18
CLI Cleaning output folder
ESM Build start
ESM dist/index.js              552.00 B
ESM dist/bin.js                215.00 B
ESM dist/browser.js            30.24 KB
ESM dist/chunk-Z5QDSVHR.js     415.58 KB
ESM dist/chunk-V6MBCKVR.js     422.16 KB
ESM dist/bin.js.map            556.00 B
ESM dist/index.js.map          71.00 B
ESM dist/browser.js.map        61.42 KB
ESM dist/chunk-Z5QDSVHR.js.map 1005.77 KB
ESM dist/chunk-V6MBCKVR.js.map 787.04 KB
ESM ⚡️ Build success in 260ms
DTS Build start
DTS ⚡️ Build success in 10979ms
DTS dist/index.d.ts        68.49 KB
DTS dist/browser.d.ts      13.43 KB
DTS dist/hub-CUJHMMTq.d.ts 136.66 KB

> open-book@0.0.0-workspace check:gen /Users/eliot/Workspaces/OpenBook-wt-meet-1
> pnpm --filter @book.dev/ui run check:gen


> @book.dev/ui@3.17.0 check:gen /Users/eliot/Workspaces/OpenBook-wt-meet-1/packages/ui
> pnpm run gen:bundled-plugins && (git diff --exit-code -- src/plugins/bundled.gen.ts src/export/ledgerFolds.gen || (echo 'Committed .gen mirror is STALE: run pnpm --filter @book.dev/ui run gen:bundled-plugins and commit the result.' >&2 && exit 1))


> @book.dev/ui@3.17.0 gen:bundled-plugins /Users/eliot/Workspaces/OpenBook-wt-meet-1/packages/ui
> node --import tsx scripts/bundlePlugins.ts

[bundlePlugins] OPENBOOK_REGISTRY_PRIVATE_KEY is unset — signing with the committed TEST-ONLY key (scripts/test-registry-key.json). Fine for dev/test; production builds must set the secret (docs/plugin-signing.md).
wrote src/plugins/bundled.gen.ts (1 plugin(s), signed by OpenBook Test Registry [test])
wrote src/export/ledgerFolds.gen (2 fold module(s))

> open-book@0.0.0-workspace typecheck /Users/eliot/Workspaces/OpenBook-wt-meet-1
> pnpm -r --if-present run typecheck

Scope: 6 of 7 workspace projects
packages/sdk typecheck$ tsc -p tsconfig.json --noEmit
packages/sdk typecheck: Done
packages/ui typecheck$ tsc --noEmit
packages/ui typecheck: Done
packages/app typecheck$ tsc --noEmit
packages/app typecheck: Done
packages/server typecheck$ tsc --noEmit
packages/mcp typecheck$ tsc --noEmit
packages/mcp typecheck: Done
packages/server typecheck: Done
packages/web typecheck$ tsc --noEmit
packages/web typecheck: Done

> open-book@0.0.0-workspace lint /Users/eliot/Workspaces/OpenBook-wt-meet-1
> pnpm -r run lint

Scope: 6 of 7 workspace projects
packages/sdk lint$ eslint .
packages/sdk lint: Done
packages/ui lint$ eslint . && pnpm run lint:css && pnpm run test:stylelint
packages/ui lint: > @book.dev/ui@3.17.0 lint:css /Users/eliot/Workspaces/OpenBook-wt-meet-1/packages/ui
packages/ui lint: > stylelint src/index.css
packages/ui lint: > @book.dev/ui@3.17.0 test:stylelint /Users/eliot/Workspaces/OpenBook-wt-meet-1/packages/ui
packages/ui lint: > node scripts/assert-spacing-stylelint.mjs

Node.js v24.14.1

Node.js v24.14.1

```

</details>
