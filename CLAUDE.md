## Fluid Functionalism

- 2026-10-27 — Boundary (supersedes `docs/design/design-system-manifest-2026-10.md` §0 G1): FF may govern core block visuals too, not just chrome; the export-mirror question (FF-6) gates block-level FF motion, and the narrowed lint guard holds until ruled: Tailwind utilities may enter core block CSS only via tokens the export mirror covers; conservatively reject Tailwind-generated variables for now.
- 2026-10-27 — Motion (FF-3; supersedes `docs/design/design-system-manifest-2026-10.md` §2.1 timing tokens and §2.2 chrome motion table): retune `--motion-fast/base/slow` 120/180/240 → 80/160/240ms and add `@/lib/springs` with FF `{duration, bounce}` objects 0.08/0, 0.16/0, 0.24/0.12; exits are tweens one tier quicker, 0.06/0.12/0.16s. Deliberately keep two lanes: CSS tokens for export/viewer tweens; springs for interruptible `motion/react` chrome.
- 2026-10-27 — Switch (FF-3; supersedes `docs/design/design-system-manifest-2026-10.md` §2.1 `--ease-spring` and §2.2 “Switch knob / kit toggle”): move `.obe-kit-knob` to the moderate tier; retire `--ease-spring` when unused.
- 2026-10-27 — Fluid hover (FF-4): adopt in chrome menus first — dropdown, select, command palette, form palette.
- 2026-10-27 — Font (FF-5): ship InterVariable with `font-weight: 100 900` and `opsz` as a face-of-product decision.
- 2026-10-27 — Loading (FF-1): use eager `motion.*` imports from `motion/react`; registry files use `motion.*`, which throws under `LazyMotion strict`, so eager loading leaves future FF installs unedited. Accept one library's bundle cost now; revisit if the bundle budget complains.

- 2026-10-27 — Uppercase eyebrows (supersedes `docs/design/design-system-manifest-2026-10.md` §1.1 uppercase sanction, formerly lines 60–61): adopt FF’s ban on uppercase/letter-spaced eyebrow labels; the prior DSX sanction is superseded by owner ruling. Migration of the approximately 25 call sites belongs to a later card.
- 2026-10-27 — Control ladder (supersedes `docs/design/spacing-manifest-2026-08.md` §1.1 SPC-1 height table, formerly lines 29–32): adopt FF’s 36/28px two-step ladder over SPC-1’s 24/28/32/36px ladder; the old ladder is superseded by owner ruling. Component size migration belongs to a later card.

FF skill vendored copies live in worker worktrees at `_ff-skill/`, uncommitted; fetch from github.com/mickadesign/fluid-functionalism when needed.
