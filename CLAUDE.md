## Fluid Functionalism

- 2026-10-27 — Boundary (G1 amended): FF may govern core block visuals too, not just chrome; the export-mirror question (FF-6) gates block-level FF motion, and the narrowed lint guard holds until ruled: Tailwind utilities may enter core block CSS only via tokens the export mirror covers; conservatively reject Tailwind-generated variables for now.
- 2026-10-27 — Motion (FF-3): retune `--motion-fast/base/slow` 120/180/240 → 80/160/240ms and add `@/lib/springs` with FF `{duration, bounce}` objects 0.08/0, 0.16/0, 0.24/0.12; exits are tweens one tier quicker, 0.06/0.12/0.16s. Deliberately keep two lanes: CSS tokens for export/viewer tweens; springs for interruptible `motion/react` chrome.
- 2026-10-27 — Switch (FF-3): move `.obe-kit-knob` to the moderate tier; retire `--ease-spring` when unused.
- 2026-10-27 — Fluid hover (FF-4): adopt in chrome menus first — dropdown, select, command palette, form palette.
- 2026-10-27 — Font (FF-5): ship InterVariable with `font-weight: 100 900` and `opsz` as a face-of-product decision.
- 2026-10-27 — Loading (FF-1): use eager `motion.*` imports from `motion/react`; registry files use `motion.*`, which throws under `LazyMotion strict`, so eager loading leaves future FF installs unedited. Accept one library's bundle cost now; revisit if the bundle budget complains.

FF skill vendored copies live in worker worktrees at `_ff-skill/`, uncommitted; fetch from github.com/mickadesign/fluid-functionalism when needed.
