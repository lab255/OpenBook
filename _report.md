# MEET-4 — Drew

MEET-4 complete. `pnpm verify` passed in the foreground (exit 0); implementation and report committed separately. Not pushed.

Implementation HEAD: `888f8956cc347a544912c342c7f3d8d77d1c08f6`. The following report-only commit records this verified implementation SHA; final HEAD is the report commit.

## Criterion → test map

| Criterion | Evidence |
| --- | --- |
| Catalogue, schemas, defaults/patch semantics, invalid nested values | `packages/sdk/src/blockCatalogue.test.ts` |
| `list_block_types` exposes meeting + propsSchema; MCP creation/update acceptance and rejection | `packages/mcp/scripts/blockTypes.test.mts` (67 checks) |
| Agent `add_blocks` and `update_block_props` validate before suggesting | `packages/server/src/ai/agentBlockTypes.test.ts` (13 tests) |
| Runtime kit registry matches catalogue; notes/props survive UI serialization | `packages/ui/src/blockeditor/registryCatalogue.test.tsx` |
| README and generated matrix drift guards | `packages/mcp/scripts/readme.test.mts`, `coverage.test.mts`; 45 catalogue types + 9 plugin blocks, no exemptions |
| Workspace definition of done | `pnpm verify`, foreground, exit 0 (outside sandbox for filesystem watchers) |

## Validation output

Full output: [verification log](/Users/eliot/.bb/thread-storage/meet-4-verify-888f8956.log). Command: `pnpm verify`, foreground, outside sandbox; exit **0**.

```text
SDK:    32 files, 565 tests passed
UI:     244 files, 2320 tests passed
App:    2 files, 7 tests passed
Server: 97 files, 1327 passed / 6 existing skipped (1333)
MCP:    All 45 catalogue types + 9 plugin blocks have MCP API coverage; exemptions: none.
Server e2e: ALL 256 CHECKS PASSED
MCP e2e:    ALL 70 CHECKS PASSED
```

ESLint-rule tests, builds, generated-file guard, workspace typechecks and lint also passed. Pre-commit ESLint/typechecks and commitlint passed.

## THE REPRESENTATION CONTRACT

`meeting` is a `kit` block with `nature: 'container'`, no required parent, and
`kitValue: false`. It publishes no reactive value. Its `children` are ordinary
manual-note blocks (paragraphs, todos, headings, groups, etc.), not transcript
segments. No dedicated notes slot or child-only type is required.

All top-level props are optional. Missing status means `idle`; missing arrays
mean empty lists; missing summary/title mean empty text; missing startedAt means
not started. These are consumer defaults, not schema-inserted persisted values.
As with other block props, patches shallow-merge; `null` removes a top-level key.
Unknown top-level props remain allowed for forward compatibility.

| Prop | Stored shape and meaning |
| --- | --- |
| `status` | `'idle' \| 'recording' \| 'processing' \| 'done'`. Validation checks the enum, not state transitions. |
| `audioChunks` | Ordered array of `{assetId: string, durationMs: number, startedAtMs?: number}`. `assetId` is a nonempty asset reference (max 512 characters), never inline audio. `durationMs` is the chunk duration; optional `startedAtMs` is an offset from meeting start, **not** Unix time. Array order is capture/playback order. |
| `transcript` | Ordered array of `{startMs: number, endMs: number, text: string}`. Offsets are relative to meeting start; `endMs >= startMs`. Text is plain text. Array order is display order; overlapping segments are allowed. |
| `summary` | Plain string; no rich-text runs or Markdown interpretation is required. |
| `startedAt` | Unix epoch milliseconds, a finite nonnegative number. |
| `title` | Optional plain string. |

All durations and offsets are finite nonnegative numbers in milliseconds;
fractional milliseconds are accepted. Every listed nested field is required
except `startedAtMs`; nested objects reject extra keys and null fields. Empty
arrays and empty transcript text are valid. Cross-field `endMs >= startMs` is
checked at runtime and described in the JSON schema (standard JSON Schema cannot
express a comparison to a sibling field). Asset existence, timeline sorting,
status transitions, and transcription size limits are producer responsibilities.

Audio chunks and transcript segments use structured props, following existing
kit option/rich-run arrays and the form's structured schema prop. They are
machine-produced snapshots, while manual notes need independently editable CRDT
children. Each array is one prop value: updates replace the whole array, with
no per-segment merge guarantee. Recording/transcription producers should batch
updates and serialize writes to avoid concurrent array replacement losing data.
This keeps the first representation small and consistent; large-transcript
storage migration, if needed later, must explicitly version this contract.

MEET-4 registers a minimal meeting shell through `registerArtifactKit` in both
editor and viewer hosts. It displays title, status, and saved note-block count;
notes remain stored but are not yet rendered/editable inside the shell. It has
no slash-menu entry or recording controls. MEET-5 replaces this renderer and
must render the existing child blocks rather than migrate them into props.

## Deviations and open questions

- The first full verification attempt hit transient `EADDRINUSE` on MCP port 4410. The listener had exited on inspection; no process was killed and no test was weakened.
- The new negative test exposed that creation paths previously validated structure but skipped props. Added shared SDK `invalidBlockTreeProps` to MCP creation/append/insert and agent `add_blocks`, validating all declared schemas recursively before writes or suggestions. Existing update validation remains shared.
- Full verification exposed an unrelated dated fixture in `ableOidc.test.ts`: its purportedly valid PAT expired at fixed September 8, 2026 time, while SQL validates against `now()`. Reproduced the 401-versus-302 failure; changed only the fixture to `Date.now() + 60_000`, preserving every assertion. The focused regression passed afterward.
- A later full run ended without a normal summary after export fixture failures and zero-test collection failures while the host disk was nearly full. The export suite (`bookFolder.test.ts`) passed all 12 tests unchanged in isolation; both end-to-end suites also passed (256 server / 70 MCP checks). Restarted full verification, including bundle rebuilds.
- Diagnosed filesystem-watch failures: the unchanged mirror integration suite produced `EMFILE` inside the sandbox despite a 1,048,575 descriptor limit, then passed all 3 tests outside it. Stopped only this worktree’s already-failed sandboxed test process and reran full foreground verification outside the sandbox after automatic approval. No tests or assertions were disabled.
- Minimal kit registration is intentional, not a drift-guard exemption. MEET-5 replaces the placeholder; notes are preserved but not yet displayed/editable in it.
- No unresolved MEET-4 questions. MEET-5/6/7 must follow the contract above, including epoch vs relative timestamps and whole-array replacement. Recording controls, transcription transport, and large-transcript storage policy remain later work.
