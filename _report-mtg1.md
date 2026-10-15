MTG-1 complete. Foreground `pnpm verify` GREEN (exit 0); meeting browser e2e 2/2 GREEN. No push.

| Acceptance | Commit / evidence |
| --- | --- |
| Header, management slot, tabs, transcript split | `a9966ed0`; MeetingBlockView 69 lines; MeetingHeader exposes optional management slot |
| Summary / Notes / Transcript remain mounted | `a9966ed0`, `5194d083`; meetingTabs: stateful draft + actual CRDT editor identity/content persistence, keyboard navigation, defaults |
| Record → pause → resume → stop, status / elapsed | Existing recorder tests; meeting-epic browser lifecycle passes |
| Read-only / hydrated viewer | `5194d083`; viewer meeting tabs switch with frozen notes and disabled mutation controls |
| Tokens / four locales | `a9966ed0`; existing `.obe-tab` recipe reused; changed components ESLint: zero warnings; CSS lint + DSX guards pass; `meetingBlock.tabs` translated en/de/ja/zh |
| Tests / verification | Focused 81/81; UI 260 files, 2,602 tests; meeting-epic 2/2 including microphone denial; full foreground `pnpm verify` exit 0 (builds, generation, types, lint, unit suites, server + MCP e2e) |

Decisions: Transcript during requesting/recording/paused/processing; otherwise Summary when nonblank, else Notes. Defaults follow lifecycle until explicit tab selection, then preserve that selection. All panes use CSS-hidden DOM, with roving keyboard focus and linked tab/panel IDs. Existing disabled read-only controls and global audio export retained. Summary and audio players unchanged; old layout tests now select their pane without weakening assertions.

Validation deltas: initial indentation errors fixed by commit hook. Sandbox blocked Chromium Mach ports and filesystem watchers (`EMFILE`, mirror integration failure); browser rerun passed 2/2 without retries, isolated unsandboxed mirror rerun passed 3/3. Full verification rerun outside sandbox passed. Existing repository lint/i18n debt remains; no new meeting violations or missing translations.
