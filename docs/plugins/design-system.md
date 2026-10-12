# Design-system styling for plugins

## 1. The contract

Style plugin blocks with the documented `.obe-ui-*` classes plus inline layout.
Read colours through the public CSS custom properties in §5. Tailwind utilities,
`.obe-kit-*`, other `.obe-*` internals and host TypeScript helpers are not public
plugin APIs. The normative contract is [manifest §14](../design/design-system-manifest-2026-10.md#14-plugin-ui-surface);
this guide shows how to use it in a zip-installed plugin.

## 2. Why classes, not imports

The [loader](../../packages/ui/src/plugins/loader.ts) accepts `.ts`, `.tsx`, `.js`,
`.jsx` and `.json` source files, not CSS. Only `react` and
`@book.dev/plugin-sdk` resolve as host modules; other imports must be relative
files inside your zip. Tailwind never scans that zip.

Classes give controls hover, focus-visible and disabled states. Inline styles
cannot express those selectors; hard-coded type sizes also bypass the host's
presentation-mode scaling. Keep a local map of class strings (§11), and let the
host own the recipes.

## 3. Your block's root

```tsx
<div className="obe-ui-frame" contentEditable={false}>
  <h3 className="obe-ui-title">My report</h3>
  <p className="obe-ui-muted">Updated from your workspace.</p>
</div>
```

Make the frame the root returned to the custom-block host. The host aligns the
gutter handle with its first content line and supplies the selection radius.
The frame provides the card border, fill, type, padding and vertical gap; a
nested frame has transparent fill. `contentEditable={false}` keeps the editor's
text caret out of your controls. It does not disable those controls.

## 4. Class reference

The host-only [PUBLIC_PLUGIN_UI_CLASSES](../../packages/ui/src/plugins/uiSurface.ts)
is authoritative. Recipe tokens below describe what the classes use internally;
only §5 is an allowlist for direct inline reads. Examples are HTML; in JSX write
`className` for `class`, `tabIndex` for `tabindex`, and `contentEditable={false}`.
Their host styling appears when rendered inside OpenBook.

<!-- Audit item 7's pluginUiSurface.test.ts guards the stable class list against
index.css and manifest §14. It does not parse this guide; keep this table equal
 to PUBLIC_PLUGIN_UI_CLASSES when updating it. -->

| Class | Element and recipe | Variants / states | Example |
|---|---|---|---|
| `obe-ui-frame` | Root div; `--border`, `--card`, `--foreground`, `--radius-lg`, `--obe-small-size`, `--obe-small-leading` | Nested fill transparent | <div class="obe-ui-frame" contenteditable="false">Report</div> |
| `obe-ui-title` | h3/h4; small type, weight 600 | Direct header child uses `--height-control-md` line height | <h3 class="obe-ui-title">Report</h3> |
| `obe-ui-header` | Title row; wrapping flex, bottom aligned | Link buttons take control height | <div class="obe-ui-header"><h3 class="obe-ui-title">Report</h3><button type="button" class="obe-ui-btn">Refresh</button></div> |
| `obe-ui-muted` | Secondary text; `--obe-caption-size`, `--obe-caption-leading`, `--muted-foreground` | Also combines with button | <span class="obe-ui-muted">Last updated today</span> |
| `obe-ui-eyebrow` | Field caption; caption type, weight 500, uppercase | — | <span class="obe-ui-eyebrow">Account</span> |
| `obe-ui-labelled` | Label; column flex, caption/field gap | — | <label class="obe-ui-labelled"><span class="obe-ui-muted">Name</span><input class="obe-ui-field" /></label> |
| `obe-ui-field` | Input/select; `--height-control-md`, `--radius-md`, `--border`, `--background`, small type, tabular numbers | `data-size="sm"`; focus border `--ring`; `aria-invalid="true"` destructive border; disabled dashed border, readable value; invalid border survives disabled | <label>Name <input class="obe-ui-field" placeholder="Name" /></label> |
| `obe-ui-btn` | Button; control height, `--radius-md`, `--card`, `--foreground`, `--border` | `data-variant="primary"`, `"ghost"`, `"link"`; `data-size="sm"`, `"xs"`; `data-weight="strong"`; hover, focus ring, disabled/`aria-disabled`, busy cursor | <button type="button" class="obe-ui-btn" data-variant="primary">Save</button> |
| `obe-ui-check` | Label around checkbox; caption type, muted ink, `--primary` accent | Input focus ring; disabled label cursor reset | <label class="obe-ui-check"><input type="checkbox" />Include drafts</label> |
| `obe-ui-fieldset` | Fieldset; flex, `--border`, `--radius-md`; legend caption type | — | <fieldset class="obe-ui-fieldset"><legend class="obe-ui-muted">Scope</legend><label class="obe-ui-check"><input type="checkbox" />All</label></fieldset> |
| `obe-ui-file` | File input; caption type, muted ink; native picker button uses small button recipe | Hover, focus, disabled off face | <label>Statement <input type="file" class="obe-ui-file" /></label> |
| `obe-ui-chip` | Inline token; `--height-control-xs`, `--radius-sm`, `--border`, caption type | No data hue by default | <span class="obe-ui-chip">receipt.pdf</span> |
| `obe-ui-notice` | Message; `--obe-notice-pad-x`, `--radius-md`, `--border`, small type | `data-tone="quiet"` default; `"info"` uses `--obe-callout-info` / `--obe-chrome-ink`; `"alarm"` uses `--obe-callout-danger` / `--destructive`, weight 600 | <div class="obe-ui-notice" data-tone="info">Drafts are excluded.</div> |
| `obe-ui-notice-detail` | Secondary notice text; weight 400, top margin | Resets alarm weight | <div class="obe-ui-notice" data-tone="alarm">Cannot compute.<div class="obe-ui-notice-detail">An account is missing.</div></div> |
| `obe-ui-table-wrap` | Scroll region; full width, horizontal overflow | Focus uses `--obe-focus-ring`, `--obe-focus-offset` | <div class="obe-ui-table-wrap" tabindex="0" role="region" aria-label="Example report">Scrollable report</div> |
| `obe-ui-table` | Table; small type, `--border` row rules; caption and headers use caption type | `data-density="compact"`, `"tight"`; `tfoot` totals; located rows and alarm cells (§9) | <table class="obe-ui-table"><caption>Accounts</caption><thead><tr><th scope="col">Account</th></tr></thead><tbody><tr><td>Cash</td></tr></tbody></table> |
| `obe-ui-num` | Numeric th/td; right alignment, tabular numbers, no wrap | Child `data-ui-mark="alarm"` uses destructive ink | <table class="obe-ui-table"><tbody><tr><th scope="row">Cash</th><td class="obe-ui-num">12.00</td></tr></tbody></table> |
| `obe-ui-total` | Summary tr outside tfoot; weight 600, no bottom rule | `data-rule` adds top rule; `data-strong` gives weight 700 | <table class="obe-ui-table"><tbody><tr class="obe-ui-total" data-rule=""><th scope="row">Total</th><td class="obe-ui-num">12.00</td></tr></tbody></table> |
| `obe-ui-section` | Rowgroup th; eyebrow type, weight 600, foreground, top padding | — | <table class="obe-ui-table"><tbody><tr><th scope="rowgroup" class="obe-ui-section">Assets</th></tr><tr><td>Cash</td></tr></tbody></table> |
| `obe-ui-pin-start` | First-column cell; sticky start, `--z-index-raised`, `--card`, `--border` inset rule | Apply only when width permits | <table class="obe-ui-table"><tbody><tr><th scope="row" class="obe-ui-pin-start">Cash</th><td>12.00</td></tr></tbody></table> |
| `obe-ui-pin-end` | Last-column cell; sticky end, same tokens as start pin | Apply only when width permits | <table class="obe-ui-table"><tbody><tr><th scope="row">Cash</th><td class="obe-ui-num obe-ui-pin-end">12.00</td></tr></tbody></table> |
| `obe-ui-list` | ul; disc markers, indent, vertical gap | — | <ul class="obe-ui-list"><li>Check the date.</li></ul> |
| `obe-ui-sr-only` | Visually hidden text; full clipping recipe | Remains available to assistive technology | <button type="button" class="obe-ui-btn"><span aria-hidden="true">×</span><span class="obe-ui-sr-only">Remove row</span></button> |
| `obe-ui-row` | Wrapping flex row; centred items, row/column gap | Optional layout convenience | <div class="obe-ui-row"><span>Ready</span><button type="button" class="obe-ui-btn">Run</button></div> |
| `obe-ui-stack` | Flex column; vertical gap | Optional layout convenience | <div class="obe-ui-stack"><span>First</span><span>Second</span></div> |

## 5. Tokens you may read inline

Use classes for control chrome. When you need a direct read, this is the public
allowlist from manifest §14:

| Family | Tokens | Read as |
|---|---|---|
| Theme | `--foreground`, `--muted-foreground`, `--border`, `--card`, `--background`, `--primary`, `--destructive` | `hsl(var(--foreground))`, and likewise for each token |
| Type | `--obe-small-size`, `--obe-caption-size`, `--obe-font-mono` | `var(--obe-small-size)` for size; `var(--obe-font-mono)` for font family |
| Focus | `--obe-focus-ring` | `outline: 'var(--obe-focus-ring)'` |
| Radii | `--radius-sm`, `--radius-md`, `--radius-lg` | `borderRadius: 'var(--radius-md)'` |
| Notice alignment | `--obe-notice-pad-x` | Read inside a layout `calc()` when aligning with notice content |
| Data palette | `--data-<token>-chip-bg`, `--data-<token>-chip-fg`; `--data-status-ok`, `--data-status-warn`, `--data-status-bad` | Direct `var(...)`, without `hsl()` |

Data token names are `gray`, `brown`, `orange`, `yellow`, `green`, `blue`, `purple`,
`pink`, `red`, `teal`, `cyan` and `indigo`. Use data colours only when colour encodes
a category, series or status, never for decorative emphasis. Keep the meaning
visible in text too:

```tsx
<span className="obe-ui-chip" style={{
  background: 'var(--data-green-chip-bg)',
  color: 'var(--data-green-chip-fg)',
}}>Travel</span>
```

The host [generates these palette properties](../../packages/ui/src/lib/dataColorVars.ts)
for light and dark modes. Read the properties; do not import that host module.
The editor palette is not public to plugins. Never hard-code a colour, including
fallback colours: a literal has no corresponding dark value. Theme HSL channels
need `hsl(var(...))`; data variables already contain complete colours.

## 6. Layout stays yours

Write flex, grid, gap, margin, width and wrapping inline. `obe-ui-row` and
`obe-ui-stack` are conveniences, not a grid system. For example:

```tsx
<div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(11rem, 1fr))', gap: '0.5rem'}}>
  <label className="obe-ui-labelled">
    <span className="obe-ui-eyebrow">Date column</span>
    <select className="obe-ui-field"><option>Not mapped</option></select>
  </label>
</div>
```

This is the shape of the final ledger's
[import mapping grid](../../examples/plugins/ledger/src/importBlock.tsx#L715).
The grid owns geometry; the label, caption and select own their public recipes.

## 7. States and read-only pages

Hover and focus come from the classes. Set native `disabled` for unavailable
controls. Buttons use a dashed border, muted ink and transparent fill; disabled
fields keep their values in foreground ink. The dashed edge survives
forced-colours mode and avoids asking readers to distinguish two similar greys.
Do not lower opacity or hand-paint a second disabled face.

Use [CustomBlockProps.pageReadOnly](../../packages/ui/src/blockeditor/registry.tsx#L23)
to gate document or external writes. An interactive custom block can receive
`editor.readOnly === false` on a read-only page so readers can still browse it.
The ledger derives `const pageLocked = pageReadOnly ?? editor.readOnly`; the
fallback supports its hostless test harness. Keep local report browsing available
while preventing persistence and write actions when the page is locked.

Put a visible reason beside each disabled control and connect it with
`aria-describedby`. Generate the ID per instance so two blocks do not collide:

```tsx
const whyId = React.useId();
return <div className="obe-ui-row">
  <button type="button" className="obe-ui-btn" disabled={pageLocked}
    aria-describedby={pageLocked ? whyId : undefined} onClick={save}>
    Save
  </button>
  {pageLocked && <span id={whyId} className="obe-ui-muted">
    This page is read-only, so changes cannot be saved.
  </span>}
</div>;
```

A busy label such as “Saving…” explains a temporary gate; `aria-busy="true"`
adds a progress cursor but does not disable activation. `aria-disabled="true"`
also supplies the off face, but does not block clicks or keyboard activation.
Prefer a real button with native `disabled`; enforce the gate in action logic too.

## 8. Notices

`obe-ui-notice` has three tones: `quiet` (the default) for ordinary context,
`info` for a scope limitation or explanation, and `alarm` for a broken or
uncomputable result. Reserve alarm for those failures, or readers learn to ignore
red. A legitimate negative amount, draft exclusion or attachment name is not an
alarm.

```tsx
<div className="obe-ui-notice" data-tone="alarm" role="status" aria-live="polite">
  Cannot compute this report.
  <div className="obe-ui-notice-detail">An entry refers to a missing account.</div>
</div>
```

Use `obe-ui-notice-detail` for secondary text instead of inline weight resets.
Choose live-region semantics for the interaction; the class supplies appearance,
not announcements. The ledger uses polite status updates for reports that refresh
as data changes.

## 9. Tables

Wrap wide tables in a labelled, keyboard-focusable region. The class provides
scrolling and a focus ring; the attributes provide navigation and an accessible
name. The ledger's [TableRegion](../../examples/plugins/ledger/src/reportShell.tsx#L413)
is a small local wrapper you can copy.

```tsx
<div className="obe-ui-table-wrap" tabIndex={0} role="region" aria-label="Balances">
  <table className="obe-ui-table" data-density="compact">
    <caption>Posted balances</caption>
    <thead><tr><th scope="col">Account</th><th scope="col" className="obe-ui-num">Balance</th></tr></thead>
    <tbody><tr><th scope="row">Cash</th><td className="obe-ui-num">12.00</td></tr></tbody>
    <tfoot><tr><th scope="row">Total</th><td className="obe-ui-num">12.00</td></tr></tfoot>
  </table>
</div>
```

`obe-ui-num` right-aligns tabular figures without wrapping. Use `tfoot` for totals:
its cells get weight 600 and a top rule. For summary rows elsewhere, use
`obe-ui-total`; add `data-rule` to opt into that rule and `data-strong` for weight
700. `obe-ui-section` styles a `th scope="rowgroup"`.

Default cell padding is 6/8px (vertical/horizontal). `compact` uses 4/8px;
`tight` uses 2/6px and caption-sized cell text. The ledger reports use compact;
the import preview uses tight. These are default-scale measurements.

`obe-ui-pin-start` and `obe-ui-pin-end` pin first and last cells. Measure the
region and remove the pin class when it would consume too much width, as the
[register](../../examples/plugins/ledger/src/register.tsx) does; CSS does not
make that decision for you. Keep the scroll region focusable at every width.

A row with `data-ui-state="located"` marks a jump target. A cell with
`data-ui-flag="alarm"` gets a leading alarm rule; a glyph inside `obe-ui-num`
can use `data-ui-mark="alarm"`. Pair these marks with explanatory text, following
the same reserved-alarm rule as notices.

## 10. Accessibility kit

Use `obe-ui-sr-only` for meaningful text beside a decorative icon; hide the icon
with `aria-hidden="true"`. The class includes clipping, negative margin,
white-space and border resets. It hides visually without removing the text from
the accessibility tree.

Insert `<wbr />` at meaningful boundaries in long identifiers, as the ledger's
[AccountName](../../examples/plugins/ledger/src/reportShell.tsx) does for account
paths. Use real buttons for actions, labels for fields, heading elements for
titles and scoped table headers. Classes do not add those semantics.

## 11. Worked example: the final ledger

These references describe the migrated ledger at **`569475b3`**, the base of
`feat/dsx-9d-plugin-doc`. Start by copying
[src/ui.ts](../../examples/plugins/ledger/src/ui.ts) into your plugin:

```ts
/** Public host CSS classes: this local map also works in a zip-installed plugin. */
export const ui = {
  frame: 'obe-ui-frame', title: 'obe-ui-title', header: 'obe-ui-header', muted: 'obe-ui-muted', eyebrow: 'obe-ui-eyebrow',
  labelled: 'obe-ui-labelled', field: 'obe-ui-field', btn: 'obe-ui-btn', check: 'obe-ui-check', fieldset: 'obe-ui-fieldset', file: 'obe-ui-file',
  chip: 'obe-ui-chip', notice: 'obe-ui-notice', noticeDetail: 'obe-ui-notice-detail', tableWrap: 'obe-ui-table-wrap', table: 'obe-ui-table',
  num: 'obe-ui-num', total: 'obe-ui-total', section: 'obe-ui-section', pinStart: 'obe-ui-pin-start', pinEnd: 'obe-ui-pin-end',
  list: 'obe-ui-list', srOnly: 'obe-ui-sr-only', row: 'obe-ui-row', stack: 'obe-ui-stack',
} as const;
export type NoticeTone = 'alarm' | 'info' | 'quiet';
```

This map is local source, not an SDK import. Here is the styling change in
[SetupPrompt](../../examples/plugins/ledger/src/reportShell.tsx#L288), reduced to
the control and its reason. The “before” is a schematic inline-recipe version;
keep the real function's setup callback, busy state and error handling.

```tsx
// Before: local recipes must coordinate chrome and the disabled face.
<div style={{display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem'}}>
  <button type="button" style={readOnly ? offButtonStyle : buttonStyle}
    disabled={readOnly || busy} aria-describedby={readOnly ? whyId : undefined}
    onClick={setUp}>
    {busy ? 'Setting up…' : label}
  </button>
  {readOnly && <span id={whyId} style={mutedStyle}>
    This page is read-only, so the books cannot be set up from it.
  </span>}
</div>

// After: native disabled state also selects the host's off face.
<div className={ui.row}>
  <button type="button" className={ui.btn}
    disabled={readOnly || busy} aria-describedby={readOnly ? whyId : undefined}
    onClick={setUp}>
    {busy ? 'Setting up…' : label}
  </button>
  {readOnly && <span id={whyId} className={ui.muted}>
    This page is read-only, so the books cannot be set up from it.
  </span>}
</div>
```

Read [trialBalance.tsx](../../examples/plugins/ledger/src/trialBalance.tsx) for a
report: frame, heading, scope notices, numeric columns and a labelled table
region. Read the journal [block.tsx](../../examples/plugins/ledger/src/block.tsx)
for a form: inline posting-grid geometry, fields, write gates and reasons beside
controls. The [import mapping grid](../../examples/plugins/ledger/src/importBlock.tsx#L715)
is the labelled-grid example.

For a heading with an icon, copy
[balanceSheet.tsx](../../examples/plugins/ledger/src/balanceSheet.tsx#L189): the
hidden icon span belongs **inside the h3**, so it shares the title's line box.

```tsx
<h3 className={ui.title}>
  <span aria-hidden="true">📒 </span>Balance sheet
</h3>
```

Two historical ledger patterns are **non-idiomatic; do not copy them**:

- The journal's [attachment control](../../examples/plugins/ledger/src/block.tsx#L831)
  uses `span[role=button]`. Use a real `<button type="button">` for a new control,
  with native keyboard and disabled behaviour.
- Its [error-code spans](../../examples/plugins/ledger/src/block.tsx#L651) retain
  inline `fontWeight: 400`. Use `obe-ui-notice-detail` for secondary notice text.

## 12. Compatibility and stability

The surface is available from the host release that ships DSX-9a. On an older
host these classes are unknown: semantic controls remain usable with the host's
native/default styling, but the frame and recipes are absent.

No `apiVersion` bump is needed: this is a CSS contract, not a new runtime API.
Class renames are breaking changes. The host registry and
[pluginUiSurface.test.ts](../../packages/ui/src/plugins/__tests__/pluginUiSurface.test.ts)
guard the class list against CSS and manifest §14. The local `ui` map adds no
host import requirement. Keep to this documented surface so internal host
refactors do not become plugin dependencies.

## 13. Plugin-PR checklist

- Root is `obe-ui-frame` with `contentEditable={false}`.
- Only public classes and §5 tokens style chrome; no Tailwind, host helper imports
  or internal class dependencies.
- No literal colours, including literal `hsl(...)` values or fallback colours;
  `hsl(var(--foreground))` is a token read and is allowed.
- No literal `fontSize` or `borderRadius`; use classes or allowlisted tokens.
- Layout stays inline; data colours encode data and have visible text meaning.
- Every disabled control has a visible reason; connect adjacent explanations with
  `aria-describedby`, and gate writes with `pageReadOnly`.
- Actions use real buttons; fields have labels; icons and long identifiers remain
  accessible. Alarm notices describe broken or uncomputable results.
- Tables have numeric alignment, semantic headers/totals and labelled, focusable
  scroll regions; pins release when space is too narrow.
- Check light/dark, edit/read-only, presentation mode, keyboard focus and
  forced-colours behaviour in the host.
