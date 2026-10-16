/** App-chrome status colour (DSX-8). Surfaces = §5.2 callout tint; inks/chips/dots = data-palette
 *  status trio (§7). Literal strings so Tailwind generates them (ui-scanned module). */
export const WARN_SURFACE_CLASS = 'bg-[var(--obe-callout-warn)] text-foreground';
export const WARN_ICON_CLASS = 'text-[var(--obe-fg-yellow)]';
export const STATUS_INK_CLASS = {
  ok: 'text-[var(--data-green-chip-fg)]',
  warn: 'text-[var(--data-yellow-chip-fg)]',
  bad: 'text-destructive',
} as const;
export const STATUS_DOT_CLASS = {
  ok: 'bg-[var(--data-status-ok)] shadow-[inset_0_0_0_1px_var(--data-stroke)]',
  warn: 'bg-[var(--data-status-warn)] shadow-[inset_0_0_0_1px_var(--data-stroke)]',
} as const;
