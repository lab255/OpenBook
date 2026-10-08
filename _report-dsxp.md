# DSX-P

Implemented: stored `warn` callouts get their warning tint/icon; all 18 theme/text pairs clear 4.5:1; all 54 palette export entries mirror CSS. UI: **2,484/2,484 tests pass**. Full verify is not green (SDK timeout); browser failure set matches baseline. No push.

## Acceptance map

| Criterion | Commit | Guard / result |
|---|---|---|
| Warn callout export; success/danger drift check | `b236073a` | `export.test.ts`: projected editor fixtures assert matching variant, tint and icon; legacy `warning` alias retained. Baseline regression check: warn fails, success/danger pass; fixed suite 20/20 passes |
| Text contrast in both themes | `f2438401` | `colors.test.ts`: 18 WCAG checks against parsed theme backgrounds |
| 9 × fg/bg/hl × light/dark parity | `f2438401` | `colors.test.ts`: 54 HSL→hex comparisons; conversion reference checks; exportReactive fixture checks emitted colours |
| UI tests, typecheck, ESLint, stylelint | `f2438401` | `pnpm --filter @book.dev/ui run test --maxWorkers=2`: 250 files / 2,484 tests pass; typecheck, ESLint, stylelint + controls pass |
| Foreground `pnpm verify` | both | Exit 1: SDK `money.test.ts` 1e6-round-trip property exceeded 5s. Builds, check:gen, all typechecks/lint passed; SDK 579/580 passed. Isolated unchanged test retry: 27/27 passed. Integration e2e not reached. |
| Viewer/export parity e2e | both | 4 passed / 7 failed, identical failing tests on pre-change `190c5504` baseline and this branch |

## Visual delta

Only these CSS values changed; hue/saturation, every background/highlight and all dark CSS values are unchanged. Ratios use unrounded sRGB against `--background` (white / 13% gray).

| Light text | Old HSL → new HSL | Contrast old → new |
|---|---|---|
| Orange | `28 80% 42%` → `28 80% 39%` | 4.0781 → 4.6324 |
| Yellow | `42 80% 36%` → `42 80% 33%` | 3.9197 → 4.5553 |

Dark text minimum: red 5.6388:1; no adjustment needed. Light minimum after adjustment: yellow 4.5553:1.

| Export token | Light fg old → new | Light hl old → new | Dark fg old → new |
|---|---|---|---|
| gray | `#6b7280` → `#737373` | `#e5e7eb` → `#8c8c8c47` | `#9ca3af` → `#a8a8a8` |
| brown | `#92400e` → `#835b3f` | `#ece0d8` → `#bf75404d` | `#c8956b` → `#c59877` |
| orange | `#c2410c` → `#b35e14` | `#ffedd5` → `#f48c2552` | `#fb923c` → `#f0994c` |
| yellow | `#a16207` → `#976f11` | `#fef3c7` → `#f9ce1f66` | `#fcd34d` → `#ecc551` |
| green | `#15803d` → `#2b8248` | `#dcfce7` → `#31c4624d` | `#4ade80` → `#66cc88` |
| blue | `#1d4ed8` → `#2073c5` | `#dbeafe` → `#3994ef47` | `#60a5fa` → `#6cabea` |
| purple | `#7e22ce` → `#7941c8` | `#f3e8ff` → `#8e57db4d` | `#c084fc` → `#b38de7` |
| pink | `#be185d` → `#ca2b7a` | `#fce7f3` → `#e64c994d` | `#f472b6` → `#e981b5` |
| red | `#b91c1c` → `#ce2727` | `#fee2e2` → `#e4444447` | `#f87171` → `#e97777` |

New bg and dark hl mirrors do not change existing CSS.

CSS stays authoritative: parsing literals in tests avoids a runtime CSS loader or a generated stylesheet migration before the foundation redesign. Export tables now include bg and dark values. Eight-digit tint hex preserves alpha, including on nested coloured surfaces; channels/alpha round to the nearest byte. Legacy dark text variables derive from the dark table instead of a third hard-coded palette. Clipboard import now recognizes browser-serialized `rgba()` tints, guarded by a round-trip colour fixture. Existing export fixture assertions were updated to the new exact values, not removed.

Callout change is the stored-variant bug fix; broader callout visual redesign remains with its owning family. The `warning` alias preserves old exports/documents. Manager handles captures: compare orange/yellow editor text, coloured exported text/highlights and warn callouts.

## Open questions

Viewer harness is not green at baseline: safe-expression runtime unavailable, sandboxed HTML counter, static expression value, and ledger request assertions fail. Chromium required an approved sandbox escape (macOS bootstrap registration denial). Baseline comparison used an isolated `/tmp/dsxp-baseline` archive, freshly built viewer and regenerated fixtures; no repository tests were weakened. Full verification remains red due to the SDK timeout under load; its unchanged isolated retry passes. No timeout/config was relaxed. Default-concurrency UI run had one ledger property timeout; the complete two-worker run passed all 2,484 tests without changing tests/timeouts. Integration e2e remains unrun because verify stopped at SDK tests.


Validation logs: `/tmp/dsxp-verify.log`, `/tmp/dsxp-ui-limited.log`, `/tmp/dsxp-ui-lint.log`, `/tmp/dsxp-viewer-final.log`, `/tmp/dsxp-baseline-viewer.log`, `/tmp/dsxp-sdk-money.log`. Required follow-up: rerun the full gate under lower host load; resolve existing viewer runtime failures separately.
