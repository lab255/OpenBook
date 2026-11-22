# Meeting block — THE REPRESENTATION CONTRACT (MEET-4)

`meeting` is a `kit` block with `nature: 'container'`, no required parent, and
`kitValue: false`. It publishes no reactive value. Its `children` are ordinary
manual-note blocks (paragraphs, todos, headings, groups, etc.), not transcript
segments. An optional child-only `meetingsummary` container holds editable summary blocks.
It has no props, sits first, and has deterministic id `<meetingId>:summary`. Readers
deduplicate concurrent creation by selecting the first container. Notes never move.

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
| `transcriptionCompleted` | Optional `string[]` of successfully transcribed chunk keys, each `startedAtMs:assetId` (a nonnegative number, a colon, then a nonempty asset ID). The recorder’s `chunkKey` uses `0` when `startedAtMs` is absent. Used to skip already transcribed chunks on retry, including chunks with empty transcription results. Missing means an empty list; `null` removes the prop. Existing keys are preserved unchanged; duplicates and non-UUID asset IDs are allowed. Updates replace the whole array. |
| `summary` | Legacy plain string fallback, rendered/exported one paragraph per non-empty line only while no summary container exists. |
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

Summary materialises lazily on the first successful Generate or first Summary edit.
Creation and clearing the legacy `summary` prop share one transaction. Failed or
cancelled generation leaves the document unchanged. Regeneration of an editable
container requires confirmation before replacing its blocks. Summary paragraphs,
decisions (lists), and actions (checkable todos) are ordinary editable CRDT blocks.
Exports emit summary blocks before direct note children. Existing note CRDT nodes
must never be migrated or clone-moved into another container.
