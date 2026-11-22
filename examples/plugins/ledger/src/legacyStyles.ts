import type React from 'react';

/** Temporary 9b/9c compatibility only. Remove with the remaining write-surface callers. */
// ── Styles ────────────────────────────────────────────────────────────────────

export const frameStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
  padding: '0.75rem',
  border: '1px solid hsl(var(--border))',
  borderRadius: 8,
  background: 'hsl(var(--card))',
  color: 'hsl(var(--foreground))',
  fontSize: '0.85rem',
};

export const titleStyle: React.CSSProperties = {
  fontSize: '0.95rem',
  fontWeight: 600,
};

/**
 * Secondary text colour for the reports.
 *
 * DS-1 lands `--muted-foreground` at the fixed 43.2% light / 59.1% dark values,
 * clearing AA across the host's audited canvas family. Reports retain this
 * stronger translucent `--foreground` for their additional opening-balance wash:
 * these are column headers, account types, cleared states, and the balance that
 * seeds every running balance below it. It measures 5.33:1 light / 5.71:1 dark
 * on the base report surface while still reading as secondary, and is defined
 * once here so the whole report family moves together.
 */
export const SECONDARY_TEXT = 'hsl(var(--foreground) / 0.72)';

export const mutedStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: SECONDARY_TEXT,
};

export const controlStyle: React.CSSProperties = {
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'hsl(var(--border))',
  borderRadius: 6,
  padding: '0.3rem 0.5rem',
  background: 'hsl(var(--background))',
  color: 'hsl(var(--foreground))',
  fontSize: '0.85rem',
};

/**
 * LONGHAND border properties, not the `border` shorthand: the same element
 * swaps between this and {@link disabledButtonStyle} as a row's state changes,
 * and React warns (and can leave a stale edge behind) when a shorthand and a
 * longhand for the same box alternate across rerenders.
 */
export const buttonStyle: React.CSSProperties = {
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'hsl(var(--border))',
  borderRadius: 6,
  padding: '0.3rem 0.75rem',
  background: 'hsl(var(--card))',
  color: 'hsl(var(--foreground))',
  fontSize: '0.85rem',
  cursor: 'pointer',
};

/**
 * A button that is OFF, and looks it.
 *
 * `disabled` alone is not a visual state: the platform's default dimming is a
 * few percent of alpha on a bordered button, and a previous task shipped a
 * disabled control pixel-identical to its enabled twin. So the off state changes
 * SHAPE (a dashed border) as well as weight, which survives a forced-colours
 * mode and does not rely on the reader distinguishing two greys.
 *
 * The dash is drawn in {@link SECONDARY_TEXT}, NOT `--border`. That was the
 * whole mechanism failing quietly: `--border` measures ~1.24:1 against the card,
 * which is below any perceptual threshold, so a "shape" cue nobody could see
 * collapsed straight back into the two-greys problem it was meant to avoid —
 * and a test asserting `border-style: dashed` passed on an invisible border.
 * `SECONDARY_TEXT` measures 5.33:1 light / 5.71:1 dark and matches the label, so
 * the button reads as one deliberately-drawn off state.
 *
 * The reason is never carried by this style — it is rendered as text beside the
 * control (or once above the table for a block-wide reason), because `disabled`
 * also removes the button from the tab order and a `title` would be a
 * mouse-only explanation.
 */
export const disabledButtonStyle: React.CSSProperties = {
  borderWidth: 1,
  borderStyle: 'dashed',
  borderColor: SECONDARY_TEXT,
  borderRadius: 6,
  padding: '0.3rem 0.75rem',
  background: 'transparent',
  color: SECONDARY_TEXT,
  fontSize: '0.85rem',
  cursor: 'not-allowed',
};

export const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '0.85rem',
};

export const thStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: SECONDARY_TEXT,
  fontWeight: 500,
  textAlign: 'left',
  padding: '0.25rem 0.5rem',
  borderBottom: '1px solid hsl(var(--border))',
  whiteSpace: 'nowrap',
};

export const tdStyle: React.CSSProperties = {
  padding: '0.25rem 0.5rem',
  borderBottom: '1px solid hsl(var(--border) / 0.5)',
  verticalAlign: 'top',
};

/** Numeric cells are columns of digits, not proportional text. */
export const numericStyle: React.CSSProperties = {
  ...tdStyle,
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
};

export const numericHeadStyle: React.CSSProperties = {
  ...thStyle,
  textAlign: 'right',
};

/**
 * Notice surfaces, in THREE severities — the distinction is load-bearing, not
 * decorative.
 *
 * `alarm` is reserved for two things only: the books not balancing, and a report
 * that could not be computed. A standing condition that is merely a caveat —
 * truncation on a large book, postings on a deleted account — renders as `info`,
 * because a red 600-weight box that is permanently on screen for every big book
 * teaches the reader to ignore red, and then the one message that matters
 * arrives into an interface that has already been desensitised to it.
 *
 * The alarm colour carries on the BORDER and a soft fill; the sentence itself
 * uses `--foreground`, the only token guaranteed to clear 4.5:1 on the card in
 * both themes (`--destructive` is a fill/border token and measures ~4.4:1 as
 * body text).
 *
 * `info` also carries a LEADING RULE. Its fill measures 1.09:1 against the card
 * and it shares `--border` with `quiet` at 1.19:1, so a "Partial read" caveat
 * and an "In balance ✓" reassurance would otherwise stack at identical visual
 * weight — the reader cannot tell a qualification from a confirmation. The rule
 * is the same device the deleted-account row already uses, one step down in
 * colour: a caveat is not an alarm.
 */
export const noticeStyle = (tone: 'alarm' | 'info' | 'quiet'): React.CSSProperties => {
  const edge = tone === 'alarm' ? 'hsl(var(--destructive))' : 'hsl(var(--border))';
  return {
    padding: '0.4rem 0.6rem',
    borderRadius: 6,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: edge,
    background: tone === 'alarm' ? 'hsl(var(--destructive) / 0.1)' : tone === 'info' ? 'hsl(var(--muted))' : 'transparent',
    color: 'hsl(var(--foreground))',
    fontSize: '0.85rem',
    fontWeight: tone === 'alarm' ? 600 : 400,
    // The leading rule is set as LONGHANDS, never a `borderLeft` shorthand
    // beside `borderWidth`/`borderColor`. A notice whose tone CHANGES between
    // renders (the LGR-11 difference readout flips quiet ⇄ info on every tick)
    // makes React remove the shorthand while the longhands remain, which it
    // warns about and which leaves the edge in an indeterminate state.
    borderLeftWidth: tone === 'info' ? 3 : 1,
    borderLeftColor: tone === 'info' ? 'hsl(var(--foreground) / 0.35)' : edge,
  };
};

