# Design-system manifest v1 — tokens + block chrome (DSX-0, 2026-10)

Status: **decisive contract, awaiting owner sign-off on the token sheet**
([`token-sheet-2026-10.html`](./token-sheet-2026-10.html) — open it in a browser; no build step).
This document is the authoritative contract for the per-block-family redesign tasks
that follow. A family task may not invent a token, a duration, a radius or a colour
literal; if it needs one, it amends this manifest first.

Format and precedent: [`spacing-manifest-2026-08.md`](./spacing-manifest-2026-08.md)
(SPC-1, spacing + control heights — still in force and not restated here). Input:
the colour-consistency manifest (OB-375, `git show 15ee286a:docs/design/colour-consistency-manifest-2026-07.md`)
— its data palette (`packages/sdk/src/dataColors.ts`) and sidebar model are in force and
are not re-decided here.

All file:line references are against `main` at `190c5504`, in `packages/ui/src/` unless
noted. Every contrast ratio below was computed (WCAG 2.1 relative luminance; text bar
4.5:1, non-text 3:1), not eyeballed.

Benchmark: decisions name **the reference editor** where its behaviour informed the
call. Matching it is not a goal in itself; each row states our own reason.

---

## 0. Global rules (apply to every section)

| # | Rule |
|---|---|
| G1 | **Export parity.** Core block visuals stay plain CSS in `index.css` (comment at :932-935). Every token a core block reads is a CSS custom property declared in the plain `:root` / `.dark` layer (:215-350). `@theme` may *alias* a token for Tailwind utilities; core block CSS never depends on a Tailwind-generated variable or utility. Nothing here prescribes Tailwind for core block visuals. |
| G2 | **Static exports inline light values.** `export/toHtml.ts` cannot read live variables; every token it needs is mirrored as a light-mode literal *derived from the same table in this manifest*, with a unit test asserting equality (pattern: `COLOR_EXPORT_HEX`, `dataColors` export inlining). |
| G3 | **Token namespaces.** Editor/content tokens: `--obe-*`. Motion durations: `--motion-*`. Easings: existing `--ease-*`. Radius: existing `--radius-*` (+ one new step). z-index: existing `--z-index-*`. No other new prefixes. |
| G4 | **Mode pairs.** Any colour token that is not derived from a theme variable (`--foreground`, `--muted`, `--ring`, …) declares both a `:root` and a `.dark` value. A literal colour with no dark value is a defect. |
| G5 | **Sequencing.** A foundation change lands first (declare tokens §1-§5, global retunes §2.4, lint guards §10 at `warn`); family tasks then migrate their own selectors. Guards flip to `error` when their baseline reaches zero. |

---

## 1. Type scale

### 1.1 Tokens (declared in `:root`, editor section)

Sizes are multiples of one root variable, so a scaling context (presentation mode,
`.ob-present-full .ob-slide` at :1706) overrides `--obe-font-size` only and the whole
ramp follows. Leadings are unitless.

| Token | Expression | Resolved | Leading token | Line box | Weight | Space above |
|---|---|---:|---|---:|---:|---:|
| `--obe-font-size` (body) | `16px` | 16px | `--obe-leading: 1.5` | **24px** | 400 | — |
| `--obe-title-size` (page title) | `calc(var(--obe-font-size) * 2.5)` | 40px | `--obe-title-leading: 1.2` | 48px | 700 | — |
| `--obe-h1-size` | `calc(var(--obe-font-size) * 1.875)` | 30px | `--obe-h1-leading: 1.3` | 39px | 600 | `--obe-h1-space: 2rem` (32px) |
| `--obe-h2-size` | `calc(var(--obe-font-size) * 1.5)` | 24px | `--obe-h2-leading: 1.3` | 31.2px | 600 | `--obe-h2-space: 1.5rem` (24px) |
| `--obe-h3-size` | `calc(var(--obe-font-size) * 1.25)` | 20px | `--obe-h3-leading: 1.3` | 26px | 600 | `--obe-h3-space: 1rem` (16px) |
| `--obe-code-size` (code block) | `calc(var(--obe-font-size) * 0.875)` | 14px | `--obe-code-leading: 1.5` | 21px | 400 | — |
| `--obe-code-inline` (inline code) | `0.875em` | 0.875 × parent | inherits | — | 400 | — |
| `--obe-small-size` | `calc(var(--obe-font-size) * 0.875)` | 14px | `--obe-small-leading: 1.43` | 20px | 400 / 500 | — |
| `--obe-caption-size` | `calc(var(--obe-font-size) * 0.75)` | 12px | `--obe-caption-leading: 1.33` | 16px | 500 / 600 | — |

DSX-2 icon role: `--obe-icon-size: calc(var(--obe-font-size) * 1.25)` (20px at body size), used by callout icons.

Also: `--obe-line: calc(var(--obe-font-size) * var(--obe-leading))` (the body line box, 24px),
`--obe-heading-weight: 600`, `--obe-font-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`
(replaces the three literal mono stacks, e.g. :1148, :1853). Uppercase eyebrows (caption
size) use `letter-spacing: 0.04em`.

### 1.2 Decisions vs today

| Item | Today | Decision | Reason |
|---|---|---|---|
| Body | `15px / 1.65` (:962-963) = 24.75px line | **16px / 1.5** = 24px line | Reading size matches the reference editor (16px/1.5); the line box stays ~24px, so vertical rhythm is preserved and the paragraph line box now equals the 24px gutter button exactly (§8.2). |
| Headings | `1.7 / 1.35 / 1.12rem` (:1143-1145), weight 650, margins 12/8/4px | **30 / 24 / 20px**, weight **600**, space above **32 / 24 / 16px** | A 1.875 / 1.5 / 1.25 ratio ramp (reference editor uses the same ratios). Weight 650 renders as 700 on non-variable system fonts (Segoe UI, Roboto), so 600 is the only weight that looks the same cross-platform. Larger space above restores section separation the 4px/8px margins lost. |
| Units | `rem` (ignores the 15px root) | multiples of `--obe-font-size` | One knob scales the ramp; gutter geometry (§8.2) can compute line boxes in absolute units. |
| Page title | `text-[2.5rem] font-bold leading-tight` (`screens/pageChrome.tsx:162`) | `--obe-title-size` 40px / 1.2 / 700 | Value unchanged; tokenized. |
| Secondary text zoo | 141 `font-size` declarations, ~30 distinct literals (0.65–0.95rem, 10–15px) | Every in-block secondary size maps to **small** (literal ≥ 0.82rem) or **caption** (literal < 0.82rem) | Two steps are enough for chrome inside a block (labels, captions, cells, chips). |

Out of scope: app-chrome type (`text-[11px]` ×74, `text-[10px]` ×31 in TSX) — flagged for
a later pass; this manifest governs the document surface.

---

## 2. Motion scale

### 2.1 Tokens

Durations are plain `:root` variables (Tailwind v4 has no duration theme namespace;
TSX consumes them as `duration-(--motion-base)`). Easings keep their existing `@theme`
names (:157-159) and are mirrored into `:root` per G1.

| Token | Value | Role |
|---|---:|---|
| `--motion-fast` | **120ms** | Hover/press chrome, reveals, all exits, tooltips |
| `--motion-base` | **180ms** | Menus/popovers entrance, toggles, knobs, value changes |
| `--motion-slow` | **240ms** | Dialogs, drawers, full-surface transitions (slides) |
| `--ease-out-soft` | `cubic-bezier(0.32, 0.72, 0, 1)` | Default for everything that enters or changes |
| `--ease-in-out-soft` | `cubic-bezier(0.65, 0, 0.35, 1)` | Exits and ambient loops |
| `--ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | **Switch knobs only** (kit switch, `components/ui/switch`). Banned in the editor and on overlays. |

`--default-transition-duration` (:155) is retuned **180ms → 120ms** (`= --motion-fast`):
the 230+ bare `transition*` utilities in TSX are overwhelmingly hover colour changes
(`transition-colors` ×156), which belong to the fast tier. 120ms is also the dominant
literal in `index.css` today (~30 of 44), so most CSS migration is a no-op rename.

### 2.2 Application table

| Interaction class | Duration | Easing | Animated properties | Today (examples) |
|---|---|---|---|---|
| Hover chrome: bg/colour/border on hover, gutter reveal, image/kit tool reveal | `--motion-fast` | `--ease-out-soft` | `color, background-color, border-color, opacity` | `120ms ease` :1032, `0.12s ease` :1301/:1337/:1384, `150ms` :3225 |
| Press (`:active`) | **0** (instant) | — | — | mixed |
| Tooltip (Radix + `.obe-kit-tip`) | enter/exit `--motion-fast` | out-soft / in-out-soft | **opacity only** (no zoom) | `zoom-in-95` in `components/ui/tooltip.tsx` |
| Menu / popover / select / context menu / slash menu / inline toolbar — **enter** | `--motion-base` | `--ease-out-soft` | opacity 0→1, scale 0.98→1, translate 2px from the anchor side | slash :2119-2141 (the model recipe); Radix `zoom-in-95`, no token duration |
| Same — **exit** | `--motion-fast` | `--ease-in-out-soft` | opacity only | `zoom-out-95` |
| Dialog / command palette / lightbox — enter | `--motion-slow` | `--ease-out-soft` | panel opacity + scale 0.98→1; scrim opacity | `components/ui/dialog.tsx:61` (180ms, zoom 95) |
| Same — exit | `--motion-fast` | `--ease-in-out-soft` | opacity | — |
| Drawer (narrow sidebar) | `--motion-slow` in / `--motion-fast` out | out-soft / in-out-soft | `transform` | Tailwind `duration-300`/`200` |
| **Block insert / delete / convert** (Enter, paste, slash convert, remote CRDT insert) | **none** | — | — | none today — keep |
| Toggle / collapse (accordion, toggle blocks, tabs container, tree disclosure) | chevron: `--motion-base` | `--ease-out-soft` | chevron `transform: rotate`; **content shows/hides instantly** | `0.15s ease` :791; Radix accordion `0.2s` :115-116 |
| Switch knob / kit toggle | `--motion-base` | `--ease-spring` (knob), out-soft (track colour) | `transform`, `background-color` | `150ms` :3237/:3225 |
| Value change (progress fill, meter) | `--motion-base` | `--ease-out-soft` | `width` / `transform` | `200ms ease` :3701 |
| Drag: drop indicator, source dim, drop | **none** (indicator tracks the pointer; no settle animation) | — | — | none — keep |
| Presentation slide enter | `--motion-slow` | `--ease-out-soft` | opacity + `translateY(16px)` → 0 | `340ms cubic-bezier(0.2,0.7,0.2,1)`, 18px :1705-1710 |

**Block entrance: none.** Typing is the animation — a block must be caret-ready on the
frame Enter lands, and an entrance replayed on every paste of 200 blocks or every
remote insert is noise (the reference editor also inserts blocks with no entrance).

**Attention signals are exempt from the scale** (they are timers, not feel): locate flash
1.2s (:2204), anchor flash 1.8s (:2218), flow pulse 0.7s (:2197), remote-cursor label
dwell 2.8s (:3606), skeleton shimmer 1.6s (:442). They keep their durations but must use
an `--ease-*` token instead of `ease-out`/`ease`. Adding a new one requires a row here.

Select exit: **none** — nested dismissable layer.

### 2.3 Reduced motion

| Rule | Decision |
|---|---|
| Mechanism | The global kill switch at :410-419 (all durations → 0.01ms, iteration-count 1) is the **single** mechanism. State changes become instant; nothing else is needed. |
| Per-component `@media (prefers-reduced-motion: reduce)` | Allowed **only** to set a non-animated end state the kill switch can't infer (e.g. `.obe-rcursor-label { opacity: 1 }` :3613). Blocks that only say `animation: none` (e.g. :2141) are redundant — delete. |
| `no-preference` gating | Allowed for scroll-coupled attention effects (anchor flash :2216-2219 pattern). |
| JS motion | Smooth `scrollIntoView`, drag auto-scroll easing and any rAF animation must check `matchMedia('(prefers-reduced-motion: reduce)')` and fall back to `auto`/instant. |

### 2.4 Global retunes (foundation change)

1. `--default-transition-duration: 120ms` (§2.1).
2. One shared Radix overlay class constant (entrance/exit per §2.2) replaces the
   per-file `zoom-in-95` strings in `components/ui/{dropdown-menu,context-menu,popover,select,tooltip,dialog}.tsx`.
3. `--animate-accordion-*` (:115-116) → `--motion-base` + `--ease-out-soft`.

---

## 3. Radius scale

Owner decision (2026-10-10): select/multi-select chips use `--radius-sm`; status chips remain pill.

DSX-2 exception: the compact 16px todo checkbox uses `--radius-sm` (4px).
The checked todo tick uses `--primary-foreground` (not white) for correct contrast in dark mode.

| Step | Token | Value | Surfaces (exhaustive by role) |
|---|---|---:|---|
| none | `0` | 0 | Table cells, dividers, full-bleed media, the rail side of quote/notes shapes |
| sm | `--radius-sm` | 4px | **Inline marks** (inline code, mention, highlight runs, `@cell` token); **items inside a menu/list**; row hover/selection wash; marquee; table grips; small tool chips inside an overlay (image size chips); select/multi-select chips |
| md | `--radius-md` | 6px | **Standalone controls**: gutter buttons, toolbar buttons, icon buttons, inputs/selects/buttons inside blocks and forms, callout icon button, tooltips, drag ghost |
| lg | `--radius-lg` | 8px | **Block surfaces** (callout, code block, image frame + img, image placeholder, group, kit cards, embeds, artifact frames) and **floating menus** (popover, dropdown, select, context, slash, inline toolbar) |
| xl | `--radius-xl` **(new)** = `calc(var(--radius) + 4px)` | 12px | Dialogs, command palette, lightbox frame, presentation slide frame |
| pill | `9999px` (TSX `rounded-full`) | — | Status chips, switches, progress track + fill, status lamps; `50%` for true circles (avatars, presence dots) |
| page | `--ob-page-radius` | ≥10px | Notebook sheets only (window-concentric, :282) |

Rules:

- **Concentric nesting:** inner radius = outer radius − padding, floored at sm. A menu
  (`p-1`, 4px) with sm items is therefore lg (4 + 4). Today's slash menu (6px container,
  7px items) violates this.
- `999px` normalizes to `9999px`. Literal `4px/6px/8px` become their tokens; any other
  literal (`7px`, the toolbar's calculated 9px, `10px`) moves to the step its *role*
  dictates, not the nearest number.
- Baseline at `190c5504`: 126 `border-radius` declarations, 42 tokened, 84 carrying a
  `px` literal (31× `8px`, 21× `6px`, 8× `4px`, 17× `999px`, 3× `9999px`, …).

---

## 4. Placeholder

**One alpha: `0.6`.** Token: `--obe-placeholder: hsl(var(--muted-foreground) / 0.6)`.

| Site | Today | After |
|---|---:|---:|
| `.obe-text:empty::before` (:1137-1141) | 0.45 | 0.6 |
| `[data-placeholder]:empty::before` (:671-674) | 0.7 | 0.6 |
| `.obe-image-alt/caption::placeholder` (:1362-1363) | 0.55 | 0.6 |
| `.block-*[data-placeholder]` (:732-739) | 0.6 | deleted (dead CSS, §11) |

Computed contrast vs page: 0.45 = 1.85 (light) / 2.19 (dark) — effectively invisible
in dark mode; **0.6 = 2.35 / 2.87** (`#aaa9a6` / `#686868`); 0.7 = 2.80 / 3.41 competes
with real secondary text. 0.6 is quiet-but-findable in both modes.

Scope boundary: **in-document hints** use `--obe-placeholder`. **Form-field placeholders**
in app chrome keep the existing opaque, AA-audited `--placeholder-foreground` (:230) —
a different role (a field label substitute, not a hint), not a second alpha.

---

## 5. Colour tokens: callout tints + code syntax

### 5.1 Editor palette hoisted to variables (no value change)

The `.obe-fg-*` / `.obe-bg-*` / `.obe-hl-*` classes (:2299-2360) are re-expressed as
`--obe-fg-<t>`, `--obe-bg-<t>`, `--obe-hl-<t>` (9 tokens × 3 roles, `:root` + `.dark`),
values **verbatim**; the classes read the variables. This lets callouts (and any family)
reference the palette by name.

### 5.2 Callout tints

Decision: **variant tints are the editor palette's block-background tints**; the default
(info) variant is the theme neutral. No border (the reference editor's callout is a
borderless tinted panel; borders double up with block-bg colours).

| Token | Maps to | Light | Dark | `--foreground` on it (L / D) |
|---|---|---|---|---:|
| `--obe-callout-info` | `hsl(var(--muted))` | `#f6f5f4` | `#2f2f2f` | 11.86 / 8.75 |
| `--obe-callout-warn` | `var(--obe-bg-yellow)` | `hsl(45 90% 52% / 0.15)` ≈ `#fdf5dc` | `hsl(45 80% 55% / 0.18)` ≈ `#453d24` | 11.84 / 7.10 |
| `--obe-callout-success` | `var(--obe-bg-green)` | `hsl(140 55% 45% / 0.13)` ≈ `#e5f5ea` | `hsl(140 50% 50% / 0.18)` ≈ `#273e2e` | 11.41 / 7.62 |
| `--obe-callout-danger` | `var(--obe-bg-red)` | `hsl(0 72% 55% / 0.12)` ≈ `#fbe7e7` | `hsl(0 65% 55% / 0.2)` ≈ `#452828` | 10.90 / 8.68 |

Replaces: `.obe-callout` `muted / 0.55` (`#fafaf9`, 1.04:1 vs page — barely visible),
and the literal `hsl(40 90% 55% / .12)` / `hsl(140 60% 45% / .1)` / `hsl(0 75% 55% / .09)`
(:1215-1217), which had **no dark values**. Export (`export/toHtml.ts:1400-1408`)
inlines the light column and drops its blue info tint and borders (see §11, finding F1).

### 5.3 Code syntax tokens

Hue-aligned to the editor palette (purple / green / orange / blue), light values
darkened until they pass 4.5:1 on the code-block surface. Surface:
`--obe-code-bg: hsl(var(--muted) / 0.6)` (`#f9f9f8` / `#2a2a2a`, unchanged),
`--obe-code-border: hsl(var(--border) / 0.7)` (unchanged).

| Token | Light | on code bg | Dark | on code bg | Today light (ratio) |
|---|---|---:|---|---:|---|
| `--obe-code-com` (italic) | `hsl(var(--muted-foreground))` | 4.75 | same | 4.92 | same |
| `--obe-code-kw` | `hsl(265 55% 48%)` `#6f37be` | 6.73 | `hsl(265 65% 73%)` `#b38de7` | 5.43 | `265 60% 46%` (7.30) |
| `--obe-code-str` | `hsl(140 50% 30%)` `#267340` | 5.55 | `hsl(140 50% 60%)` `#66cc88` | 7.26 | `140 46% 32%` (5.20) |
| `--obe-code-num` | `hsl(28 80% 38%)` `#ae5c13` | 4.60 | `hsl(28 85% 62%)` `#f0994c` | 6.43 | `28 78% 42%` (**3.91 — fails**) |
| `--obe-code-lit` | `hsl(210 72% 42%)` `#1e6bb8` | 5.18 | `hsl(210 75% 67%)` `#6cabea` | 5.94 | `210 72% 45%` (4.63) |

Dark values are exactly the editor palette's dark `fg` values for those hues, so dark
code reads as the same family as coloured prose.

---

## 6. z-index usage rules

The scale (:131-145) is complete; this section only governs use.

| # | Rule |
|---|---|
| Z1 | Every `z-index` in CSS is `var(--z-index-*)`; every TSX z utility is a named tier (`z-menu`, `z-sticky`, …). No numerals, no `z-[n]`. Baseline: 1 CSS literal (`.obe-col-divider` `z-index: 4` :3880 → `--z-index-pane-overlay`, value-preserving); **43** TSX numeric uses (`z-50` ×17, `z-10` ×13, `z-[1]` ×5, `z-20` ×3, …). |
| Z2 | **Local tiers 1–6** (`raised` … `presence`) are only meaningful inside a block's own stacking context. Block chrome uses only local tiers. |
| Z3 | Anything that must escape the page (menus, popovers, tooltips, dialogs) **portals** and uses a shared tier ≥ 40. A block never raises a local element to a shared tier to "win". |
| Z4 | Same-tier overlap is resolved by **portal/DOM order** (later mounts on top), never by inventing a tier. Tooltips share `menu` (50). |
| Z5 | New tiers require a manifest amendment and an entry in the comment block at :121-130. |
| Z6 | Do not create stacking contexts on `.obe-editor-pane` / `.obe-editor-wrap` (`transform`, `filter`, `contain`) — it breaks fixed popups (:937-942). |

---

## 7. Editor palette vs data palette boundary

| | Editor palette | Data palette |
|---|---|---|
| Source | `blockeditor/colors.ts` (`COLOR_TOKENS`, 9) + `--obe-fg/bg/hl-*` | `sdk/src/dataColors.ts` (12 tokens × pastel/vivid/muted) + `lib/dataColorVars.ts` (`--data-*`) |
| Meaning | **Authored emphasis** stored in the document | **Encodes data**: category, series, status |
| Chosen by | The author (persisted per block/run) | The viewer's appearance preference |
| Consumers | Text colour, highlight, block bg/fg, **callout tints**, **code syntax hues** | Select/tag chips, chart series, status lamps, swatch dots, kanban/board headers; board column tint = chip-bg at 50% via color-mix |

**Rule:** if the colour carries meaning *about data*, it reads `--data-*`; if it is
emphasis an author placed on prose or a block, it reads `--obe-*`. Never cross:
chips never use `obe-bg-*`; prose never reads `--data-*`. Single-value meters and
controls (progress fill, switch on, slider track) are **neither** — they use `--primary`.
Shared hue *names* stay aligned (one mental model), values do not.

---

## 8. Block-chrome contract

### 8.1 Chrome tokens

| Token | Value | Replaces |
|---|---|---|
| `--obe-gutter-btn` | `24px` (= `--height-control-xs`) | `1.5rem` :1079-1080 |
| `--obe-gutter-gap` | `4px` | :1029 |
| `--obe-gutter-clear` | `4px` (gutter → text) | implicit |
| `--obe-gutter-room` | `calc(2 * var(--obe-gutter-btn) + var(--obe-gutter-gap) + var(--obe-gutter-clear))` = **56px** | `3.4rem` (54.4px) :944, :1023 |
| `--obe-chrome-ink` | `hsl(var(--muted-foreground) / 0.8)` — 3.36 / 4.02 vs page (≥ 3:1 non-text) | `/ 0.7` (2.80 light — fails 3:1) :1084 |
| `--obe-chrome-ink-hover` | `hsl(var(--foreground))` | same |
| `--obe-chrome-hover` | `var(--hover)` | `hsl(var(--accent))` :1090 (two competing recipes today) |
| `--obe-chrome-active` | `var(--hover-strong)` | — (menu-open state had none) |
| `--obe-select-wash` | `:root` `hsl(var(--ring) / 0.14)` (`#e0eefa`), `.dark` `hsl(var(--ring) / 0.2)` (`#2b3c49`) | `accent / 0.55` + `0 0 0 2px ring / 0.35` :983-986; marquee fill :994; cell selection `/0.16` :1999 |
| `--obe-drop` | `hsl(var(--primary))`, drawn **2px solid** (3.81 / 6.11 vs page) | `2px dashed` :1113, :1121 (tables already solid :2111-2114) |
| `--obe-drag-dim` | `0.4` | table `0.45` :2116; block rows none |
| `--obe-focus-ring` / `--obe-focus-offset` | `2px solid hsl(var(--ring))` / `2px` | offset `1px` :2450 vs `2px` :2108, :3949 |

### 8.2 Gutter geometry — one rule replaces the per-type offsets

The hand-tuned `top` values at :1063-1071 are replaced by a single formula on
`.obe-gutter`; each block family **declares two variables on its own row** from its
**own layout tokens**:

```
.obe-gutter {
  top: calc(var(--obe-lead-offset, 0px)
            + (var(--obe-lead-line, var(--obe-line)) - var(--obe-gutter-btn)) / 2);
}
/* in the family's own section, e.g. headings: */
.obe-row[data-block-type='heading'][data-block-level='1'] {
  --obe-lead-offset: var(--obe-h1-space);
  --obe-lead-line: calc(var(--obe-h1-size) * var(--obe-h1-leading));
}
```

- `--obe-lead-offset` = distance from the row's top edge to the top of the first line box
  (margins + border + padding + any header row above the first line).
- `--obe-lead-line` = the first line's box height.
- Both are expressions over tokens the block already uses for its own layout. **A bare
  literal in either is a review failure.** The gutter rule contains **no** per-type selector.

| Family | `--obe-lead-offset` | `--obe-lead-line` | Resolved `top` (new ramp) | Formula on today's ramp vs hand-tuned |
|---|---|---|---:|---|
| paragraph / list / todo / quote | `0` | `--obe-line` (24px) | **0** | 0 vs 0 |
| h1 | `--obe-h1-space` | h1 size × leading (39px) | **39.5px** | 17.0 vs 18.4px |
| h2 | `--obe-h2-space` | 31.2px | **27.6px** | 10.0 vs 11.2px |
| h3 | `--obe-h3-space` | 26px | **17px** | 4.1 vs 6.4px |
| callout | callout `padding-top` (12px) | `--obe-line` | **12px** | — vs 13.6px |
| code | border + block padding + actions-row height + its gap | code size × leading (21px) | family computes | — vs 48px |
| table (with grips) | the family's grip offset (may be negative) | grip height | family computes | — vs −4px |

(The "today" column shows the formula agrees with the hand-tuned values within 2.3px —
evidence the hand tuning was approximating this rule.)

Horizontal: full gutter `left: calc(-1 * var(--obe-gutter-room))`. **Handle-only**
gutter (narrow pane `@container (max-width: 47.8rem)` :1054-1057 **and** nested columns
:1037-1040) is one variant: `left: calc(-1 * var(--obe-gutter-btn))` = −24px (replaces
`-1.5rem` and `-1.45rem`). Touch (`pointer: coarse`) and read-only keep hiding the gutter.

### 8.3 States

| State | Trigger | Visual (exact) | Motion |
|---|---|---|---|
| Rest | — | gutter `opacity: 0; pointer-events: none`; **row has no background** | — |
| Row hover / focus-within | `.obe-row:hover`, `:focus-within`, `.obe-gutter:focus-within` | gutter `opacity: 1; pointer-events: auto`. Row still has no background (reference editor: hover reveals the handle, never tints the block). | `--motion-fast` opacity |
| Gutter button hover | `:hover` | bg `--obe-chrome-hover`, ink `--obe-chrome-ink-hover`, radius `--radius-md` | `--motion-fast` |
| Gutter button active | handle menu open (`aria-expanded="true"` / `[data-state='open']`) | bg `--obe-chrome-active`, gutter pinned visible | instant |
| Keyboard focus (chrome) | `:focus-visible` | `outline: var(--obe-focus-ring); outline-offset: var(--obe-focus-offset)`; gutter pinned visible (:2454 pattern) | instant |
| Text focus | caret in block | **no row decoration** — the caret is the indicator | — |
| Selected | block in `editor.selection` | row bg `--obe-select-wash`, radius `--radius-sm`, **no outline / box-shadow** (stacked 2px rings double up between adjacent rows) | instant |
| Marquee | rubber-band drag | fill `--obe-select-wash`, `1px solid hsl(var(--ring) / 0.65)`, radius sm, `--z-index-local-overlay` | none |
| Drag source | rows being dragged | `opacity: var(--obe-drag-dim)`. **Never `pointer-events: none` on a draggable.** | instant |
| Drop indicator | `.obe-drop-{above,below,left,right}` | `::after`, `2px solid var(--obe-drop)`, `--z-index-drop-indicator`, absolutely positioned (no layout shift); above/below span the row, left/right span its height | none |
| Drag ghost | multi-block drag image | `--primary` / `--primary-foreground`, radius md, `box-shadow: var(--shadow-menu)` (replaces literal `0 2px 8px …` :1013) | — |

Application chrome (Tailwind) keeps `--ring-control` / `--ring-field` (:293-294);
editor chrome (plain CSS) uses the outline recipe above. One ring colour (`--ring`), two
idioms by layer.

---

## 9. KitFrame adoption

`blockeditor/kit/KitFrame.tsx:318` owns the custom-block shell: root `obe-kit obe-kit-{kind}`,
header (label + description), the settings gear (`KitSettings`), name/description fields,
and the wide toggle.

**Rule: every block registered through `kit/index.ts` and every app-level custom block
with a settings gear renders through `KitFrame`.** Core blocks (text, heading, list,
todo, quote, callout, code, divider, image, table, columns, group, database embed)
**never** use it — they are plain-CSS export-parity blocks.

| Block | File | Today | Required |
|---|---|---|---|
| number, text input, select, checkbox, … | `kit/inputs.tsx` | KitFrame | — |
| cards/choice, tags, … | `kit/inputs2.tsx` | KitFrame | — |
| slider | `reactiveBlocks.tsx:65` | KitFrame | — |
| form | `FormBlockView.tsx:181` | KitFrame (`symbol={false}`) | — |
| meeting | `MeetingBlockView.tsx:115` | KitFrame | — |
| **statuslight** | `kit/cards.tsx:35` | hand-rolled root + `KitSettings` | **adopt**: `symbol={false}`, header = label |
| **tooltipcard** | `kit/cards.tsx:84` | hand-rolled | **adopt**: `symbol={false}`, `hideHeader` (the term labels itself) |
| **linkcard** | `kit/cards.tsx:126` | hand-rolled | **adopt**: `symbol={false}`, `hideHeader` (the card labels itself) |
| **progressbar** | `kit/progress.tsx:36` | hand-rolled | **adopt**: `symbol={false}`, header = label; value readout stays in `control` |
| **kitchart** | `kit/charts.tsx:1522` | hand-rolled `<figure>` + own caption | **adopt**: KitFrame gains a figure-root option so its header renders as the `figcaption` (accessible name preserved) |

Acceptance: `grep -n "KitSettings" blockeditor/kit/*.tsx` matches only `KitFrame.tsx`
(today it also matches `cards.tsx`, `progress.tsx`, `charts.tsx`).

---

## 10. Lint-guard spec

Today only spacing and radius are guarded (`packages/ui/stylelint.config.mjs`;
`eslint-rules/no-arbitrary-spacing.mjs`, `no-hover-geometry.mjs`). Each new guard below
ships with positive/negative controls in `scripts/assert-spacing-stylelint.mjs` (or a
sibling) / a `*.test.mjs` like the existing rules, starts at **warn** with the baseline
recorded, and flips to **error** when the baseline is zero. Disables require a
description (`reportDescriptionlessDisables` is already on). Custom-property declarations
(`--*`) are never matched, so token blocks are unaffected.

### 10.1 stylelint (`src/index.css`)

| Guard | Rule | Allowed | Rejected | Baseline |
|---|---|---|---|---:|
| Motion durations | `declaration-property-value-disallowed-list` on `/^(transition|animation)(-duration|-delay)?$/` | `var(--motion-*)`, `0s` | `/\b\d*\.?\d+m?s\b/` (any literal time) | 44 |
| Easings | same, on `transition`, `animation`, `*-timing-function` | `var(--ease-*)`, `linear`, `steps()` | `/\bease(-in|-out|-in-out)?\b/`, `/cubic-bezier\(/` | ~40 |
| Colour literals | `declaration-property-value-disallowed-list` on `color, background, background-color, border*, outline*, fill, stroke, box-shadow, caret-color, text-decoration*, accent-color` | `hsl(var(--…) [/ a])`, `var(--…)`, `transparent`, `currentColor`, `inherit`, system colours (`Highlight`) | `/#[0-9a-f]{3,8}\b/i`, `/\b(?:hsla?|rgba?)\(\s*[0-9.]/i` | 99 |
| z-index | `declaration-property-value-allowed-list` `z-index` | `var(--z-index-*)`, `0`, `auto`, `-1` | numerals | 1 |
| Radius (tightened) | update `radiusAtom` | `var(--radius-*)`, `var(--ob-page-radius)`, `0`, `50%`, `9999px` | remove the `4px/6px/8px/999px/calc(var(--radius) - 2px)` allowances | 84 |
| Font size (editor) | `declaration-property-value-allowed-list` `font-size` in `.obe-*` | `var(--obe-*-size)`, `var(--obe-code-inline)`, `inherit`, `em` ≤ 1 | other literals | ~120 |
| Reduced-motion blocks | assert script counts `prefers-reduced-motion: reduce` occurrences | the global block + listed end-state exceptions (§2.3) | any other | 4 |

### 10.2 ESLint (TSX, `packages/ui/src`, `packages/web/src`)

| Rule (new file in `eslint-rules/`) | Flags | Allowed | Baseline |
|---|---|---|---:|
| `tailwind/no-arbitrary-motion` | `duration-<n>`, `duration-[…]`, `delay-<n>`, `ease-(in|out|in-out|linear)`, `ease-[…]`, `animate-[…]`, raw `zoom-in-95`/`zoom-out-95` outside the shared overlay constant | `duration-(--motion-*)`, `ease-out-soft`, `ease-in-out-soft`, `ease-spring` (switch files only), bare `transition*` (reads the retuned default) | 13 durations + 3 easings + 15 files with raw zoom |
| `tailwind/no-palette-color` | Tailwind palette literals `(bg|text|border|ring|fill|stroke|outline|from|via|to|decoration|caret|accent)-(slate|gray|…|rose)-\d{2,3}`, arbitrary colour brackets `-[#…]`/`-[rgb(…)]`/`-[hsl(<digit>…)]`, and hex/rgb literals in JSX `style={{…}}` colour keys | semantic utilities (`bg-muted`, `text-muted-foreground`, …), `var(--data-*)` via `dataColorVars` helpers, `var(--obe-*)` | 208 palette utilities |
| `tailwind/no-raw-z` | `z-<n>`, `z-[…]` | named tiers (`z-menu`, `z-overlay`, …) | 43 |

---

## 11. Findings recorded while auditing (not decisions — handed to the owning family)

| # | Finding | Owner |
|---|---|---|
| F1 | **Export bug:** the editor stores callout variant `warn` (`BlockEditor.tsx:2518`), but `export/toHtml.ts:1402/1406` selects `data-variant=warning` — warn callouts export with the **blue info tint**. Fix with §5.2 export mirroring. | callout family |
| F2 | **Dead CSS:** `index.css:727-930` (`.block-callout/-accordion/-divider/-button/-toc`) has no TS/TSX consumer in any package. Delete (removes a fourth placeholder alpha and literal callout hues). | foundation |
| F3 | **Editor palette contrast:** `.obe-fg-orange` (4.08) and `.obe-fg-yellow` (3.92) fail 4.5:1 as text on the light page; `COLOR_EXPORT_HEX` (`colors.ts:35`) has drifted from the CSS values (e.g. gray `#6b7280` vs `hsl(0 0% 45%)` `#737373`). §5.1 hoists values verbatim; the fix belongs to a palette audit (open question 3). | foundation / palette |
| F4 | `.obe-gutter` comment (:1024) references "`.obe-row`'s top padding" that no longer exists (`padding: 0` :981). Removed by §8.2. | chrome family |

---

## 12. Family checklist (every redesign task)

1. Only tokens from this manifest (+ SPC-1 spacing/heights); amend here before adding one.
2. Declare `--obe-lead-offset` / `--obe-lead-line` on the family's own row selector (§8.2).
3. Motion per §2.2; no block entrance; reduced motion via the global switch only.
4. Radius by role (§3); concentric nesting.
5. Colours: editor vs data boundary (§7); every non-derived colour has a dark value (G4).
6. Kit blocks through `KitFrame` (§9).
7. Exports: mirror light values with an equality test (G2); re-run the stylelint/ESLint
   baselines and report the delta.

## 13. Open questions (recommended default in bold)

1. **Body 15 → 16px and heading space 12/8/4 → 32/24/16px** is the largest visible change
   in this manifest (line box stays ~24px). *Recommend: accept* — it is the single biggest
   contributor to the benchmark's readability; the alternative (keep 15px, adopt only the
   heading ratios) is a one-token change if the owner prefers density.
2. **Charts adopt KitFrame via a figure-root option** (§9) rather than staying exempt.
   *Recommend: adopt* — the gear, wide toggle and header behaviour are otherwise duplicated
   in `charts.tsx`; the figure root keeps `figcaption` semantics.
3. **Editor-palette contrast + export drift (F3)** are recorded, not fixed, here.
   *Recommend: spin out a short palette-audit task before the text-family redesign*, so
   callout tints (§5.2) and text colours change once, together.
