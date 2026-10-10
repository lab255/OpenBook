import {describe, expect, it} from 'vitest';
// Test-only filesystem read; the published UI build intentionally omits Node
// ambient types, while Vitest itself runs this file in Node.
// @ts-expect-error -- node:fs is available to Vitest, not the browser package.
import {readFileSync} from 'node:fs';

const CSS = readFileSync('src/index.css', 'utf8');
const DOCUMENT = readFileSync('src/screens/BlockPageDocument.tsx', 'utf8');
const EDITOR_LAB = readFileSync('../web/src/components/EditorLab.tsx', 'utf8');

function ruleBody(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const start = CSS.search(new RegExp(`^[ \t]*${escaped} \\{`, 'm'));
  expect(start, `rule not found: ${selector}`).toBeGreaterThanOrEqual(0);
  const open = CSS.indexOf('{', start);
  const close = CSS.indexOf('}', open);
  return CSS.slice(open + 1, close);
}

describe('block gutter visibility', () => {
  it('does not hit-test while hidden', () => {
    expect(ruleBody('.obe-gutter')).toMatch(/pointer-events:\s*none/);
  });

  it('restores hit testing with innermost row hover or gutter focus', () => {
    const visibleGutter = ruleBody(
      '.obe-row:hover:not(:has(.obe-row:hover)) > .obe-gutter,\n.obe-gutter:focus-within',
    );
    expect(visibleGutter).toMatch(/opacity:\s*1/);
    expect(visibleGutter).toMatch(/pointer-events:\s*auto/);
  });
});

describe('block gutter pane geometry', () => {
  it('establishes inline-size containment on every editor pane, not its positioned wrapper', () => {
    expect(ruleBody('.obe-editor-pane')).toMatch(/container-name:\s*obe-editor-pane/);
    expect(ruleBody('.obe-editor-pane')).toMatch(/container-type:\s*inline-size/);
    expect(CSS).not.toMatch(/\.obe-editor-wrap\s*{[^}]*container-type/);
    expect(DOCUMENT).toContain('\'obe-editor-pane w-full pb-40\'');
    expect(DOCUMENT).toContain('\'obe-editor-wrap relative pt-2\'');
    expect(EDITOR_LAB).toContain('className="obe-editor-pane"');
  });

  it('uses pane width to collapse the top-level gutter to its grip', () => {
    expect(CSS).toContain('@container obe-editor-pane (max-width: 52.25rem)');
    expect(ruleBody('.obe-root:not(.obe-full) .obe-gutter:not(.obe-gutter-nested)')).toContain('left: calc(-1 * (var(--obe-handle-w) + var(--obe-gutter-clear)))');
    expect(
      ruleBody('.obe-root:not(.obe-full) .obe-gutter:not(.obe-gutter-nested) > button:first-child'),
    ).toMatch(/display:\s*none/);
    expect(CSS).not.toMatch(/@media[^{]*max-width[^{]*{\s*\.obe-gutter/);
  });

  it('reserves the complete gutter on every shared full-width document column', () => {
    expect(CSS).toContain('--obe-gutter-room: calc(var(--obe-gutter-btn) + var(--obe-gutter-gap) + var(--obe-handle-w) + var(--obe-gutter-clear))');
    expect(DOCUMENT).toContain(
      'fullWidth ? \'max-w-none px-[var(--obe-gutter-room)]\' : \'max-w-content\'',
    );
    const fullWidth = ruleBody('.obe-root.obe-full');
    expect(fullWidth).toMatch(/max-width:\s*none/);
    expect(fullWidth).not.toMatch(/padding-left/);
  });

  it('removes the shared reserve when the gutter cannot render', () => {
    expect(ruleBody('.obe-editor-pane.obe-readonly')).toMatch(/--obe-gutter-room:\s*0/);
    expect(DOCUMENT).toContain('!canWrite && \'obe-readonly\'');
    expect(CSS).toMatch(
      /@media \(pointer: coarse\)\s*{\s*\.obe-editor-pane\s*{\s*--obe-gutter-room:\s*0;/,
    );
  });
});

describe('table grip geometry', () => {
  it('does not charge the row grip or add-row control to the table width', () => {
    expect(ruleBody('.obe-table-wrap.obe-has-grips')).not.toMatch(/padding-left/);
    expect(ruleBody('.obe-table-add-row')).toMatch(/left:\s*0/);
    expect(CSS).not.toMatch(/\.obe-has-grips \.obe-table-add-row\s*{[^}]*left/);
  });

  it('keeps the row grip fully outside the cells and aligns the table gutter', () => {
    const grip = ruleBody('.obe-table-row-grip');
    expect(grip).toMatch(/left:\s*-1\.25rem/);
    expect(grip).toMatch(/width:\s*1\.25rem/);
    // The grip yields the column gap to the resize divider by STACKING, never by
    // `pointer-events: none` — an unhittable drag origin kills HTML5 dragstart
    // once the pointer leaves the row and `tr:hover` drops (TABLE-2).
    expect(grip).not.toMatch(/pointer-events/);
    expect(ruleBody('.obe-table-row-grip,\n.obe-table-col-grip')).toMatch(
      /z-index:\s*var\(--z-index-raised\)/,
    );
    const revealedGrip = ruleBody('.obe-table tr:hover .obe-table-row-grip');
    expect(revealedGrip).not.toMatch(/pointer-events/);
    expect(revealedGrip).toMatch(/z-index:\s*var\(--z-index-local-overlay\)/);
    expect(ruleBody('.obe-row[data-block-type=\'table\']:has(.obe-has-grips)')).toMatch(
      /--obe-lead-offset:\s*calc\(var\(--obe-block-pad-y\) - var\(--obe-gutter-clear\)\)/,
    );
  });

  it('reveals both row and column grips on keyboard focus', () => {
    const focusedGrip = ruleBody(
      '.obe-table tr .obe-table-row-grip:focus-visible,\n.obe-table-col-grip:focus-visible',
    );
    expect(focusedGrip).toMatch(/opacity:\s*1/);
    expect(focusedGrip).toMatch(/pointer-events:\s*auto/);
    expect(focusedGrip).toMatch(/z-index:\s*var\(--z-index-local-overlay\)/);
  });
});

describe('column resize styles', () => {
  it('uses the editor width, not the window width, to stack columns', () => {
    const root = ruleBody('.obe-root');
    expect(root).toMatch(/container-name:\s*obe-block-editor/);
    expect(root).toMatch(/container-type:\s*inline-size/);
    expect(CSS).toContain('@container obe-block-editor (max-width: 40rem)');
    expect(CSS).not.toMatch(/@media[^{}]*max-width[^{}]*{[^{}]*\.obe-columns/);
  });

  it('keeps a raised, touch-safe one-rem hit zone with a two-pixel hover rule', () => {
    const divider = ruleBody('.obe-col-divider');
    expect(divider).toMatch(/z-index:\s*var\(--z-index-pane-overlay\)/);
    expect(divider).toMatch(/width:\s*1rem/);
    expect(divider).toMatch(/touch-action:\s*none/);
    expect(ruleBody('.obe-col-divider::after')).toMatch(/width:\s*2px/);
    expect(ruleBody('.obe-col-divider-trailing')).toContain('right: calc(-1 * (var(--obe-columns-gap) + 1rem) / 2)');
  });

  it('lets a revealed nested gutter take pointer ownership above the column divider', () => {
    expect(ruleBody('.obe-gutter-nested')).toMatch(/z-index:\s*var\(--z-index-local-overlay\)/);
    expect(ruleBody('.obe-gutter')).toMatch(/pointer-events:\s*none/);
    expect(
      ruleBody('.obe-row:hover:not(:has(.obe-row:hover)) > .obe-gutter,\n.obe-gutter:focus-within'),
    ).toMatch(/pointer-events:\s*auto/);
  });
});


describe('block chrome rhythm', () => {
  it('paints selection in a non-interactive overlay without a row ring', () => {
    const overlay = ruleBody('.obe-row-selected::before');
    expect(overlay).toContain('inset: var(--obe-row-space-above, 0px) calc(-1 * var(--obe-block-bleed))');
    expect(overlay).toMatch(/pointer-events:\s*none/);
    expect(overlay).toContain('background: var(--obe-select-wash)');
    expect(CSS).not.toMatch(/\.obe-row-selected\s*{[^}]*box-shadow/);
    expect(ruleBody('.obe-row')).not.toMatch(/border-radius|background|box-shadow/);
  });

  it('sizes the handle independently and pads text inside the caret target', () => {
    expect(CSS).toMatch(/--obe-gutter-gap:\s*4px/);
    expect(CSS).toMatch(/--obe-gutter-clear:\s*4px/);
    expect(ruleBody('.obe-handle')).toContain('width: var(--obe-handle-w)');
    expect(ruleBody('.obe-gutter-btn')).toContain('height: var(--obe-gutter-btn)');
    expect(ruleBody('.obe-row:is([data-block-type=\'paragraph\'], [data-block-type=\'heading\'], [data-block-type=\'list\'], [data-block-type=\'todo\'], [data-block-type=\'quote\'], [data-block-type=\'notes\']) > .obe-blockbody .obe-text'))
      .toContain('padding-block: var(--obe-block-pad-y)');
    expect(CSS).not.toContain('.obe-row:focus-within > .obe-gutter');
  });

  it('reserves only the add-row height and puts add-column outside the table', () => {
    expect(ruleBody('.obe-table-wrap')).toContain('padding: 0 0 16px 0');
    expect(ruleBody('.obe-table-add-col')).toContain('right: -16px');
    expect(ruleBody('.obe-columns')).toContain('gap: var(--obe-columns-gap)');
    expect(ruleBody('.obe-col-divider')).toContain('left: calc(-1 * (var(--obe-columns-gap) + 1rem) / 2)');
  });
});


describe('container frame geometry', () => {
  it('reserves the 24px inset and lets nested handles escape without clipping', () => {
    expect(CSS).toContain('--obe-cnt-inset: var(--obe-gutter-btn)');
    expect(CSS).toContain('--obe-gutter-btn: 24px');
    expect(ruleBody('.obe-cnt')).not.toMatch(/overflow/);
    expect(ruleBody('.obe-cnt-head')).toContain('border-radius: calc(var(--radius-lg) - 1px) calc(var(--radius-lg) - 1px) 0 0');
  });
});


describe('container inset equality', () => {
  it.each(['.obe-group-body', '.obe-cnt-panel', '.obe-acc-body'])('%s uses the shared body inset', (selector) => {
    expect(ruleBody(selector)).toContain('padding: var(--obe-block-pad-y) var(--obe-cnt-inset)');
  });

  it('aligns header labels with body text, accounting for icons and tab padding', () => {
    for (const selector of ['.obe-group-head', '.obe-cnt-head']) {
      expect(ruleBody(selector)).toContain('padding: 0 var(--obe-cnt-inset)');
    }
    expect(ruleBody('.obe-group-icon')).toContain('margin-left: calc(-1 * var(--obe-cnt-inset))');
    expect(ruleBody('.obe-group-head')).toContain('gap: 0;');
    expect(ruleBody('.obe-acc-head')).toContain('gap: 0;');
    expect(ruleBody('.obe-acc-toggle')).toContain('width: var(--obe-cnt-inset)');
    expect(ruleBody('.obe-tabs-strip')).toContain('padding-inline-start: calc(var(--obe-cnt-inset) - 8px)');
    expect(ruleBody('.obe-tabs-strip')).toContain('margin-inline-start: calc(-1 * var(--obe-cnt-inset))');
  });
});


describe('container header rhythm', () => {
  it.each(['.obe-group-head', '.obe-cnt-head', '.obe-acc-head'])('%s shares the 32px header height', (selector) => {
    expect(ruleBody(selector)).toContain('min-height: var(--height-control-md)');
  });

  it('fixes tab height independently of the caption-sized completion badge', () => {
    expect(ruleBody('.obe-tab')).toContain('height: var(--height-control-sm)');
    expect(ruleBody('.obe-cnt-badge')).toContain('height: calc(var(--obe-caption-size) * var(--obe-caption-leading))');
    expect(ruleBody('.obe-cnt-badge')).toContain('font-size: var(--obe-caption-size)');
    for (const selector of ['.obe-group-name', '.obe-tab', '.obe-acc-label', '.obe-cnt-add']) {
      expect(ruleBody(selector)).toContain('font-size: var(--obe-small-size)');
    }
    for (const selector of ['.obe-tab-on', '.obe-acc-label']) {
      expect(ruleBody(selector)).toContain('font-weight: 600');
    }
  });
});


describe('container handles and keyboard targets', () => {
  it('centres each frame handle on its 32px header with a 9px gutter top', () => {
    const header = ruleBody('.obe-row:is([data-block-type=\'group\'], [data-block-type=\'tabs\'], [data-block-type=\'accordion\'])');
    expect(header).toContain('--obe-lead-offset: calc(var(--obe-block-pad-y) + 1px)');
    expect(header).toContain('--obe-lead-line: var(--height-control-md)');
    expect(CSS).toContain('[data-block-type=\'group\'], [data-block-type=\'tabs\'], [data-block-type=\'accordion\']),');
  });

  it('includes all container controls in the shared visible-focus rule', () => {
    const focus = ruleBody('.obe-image-placeholder:focus-visible');
    // DSX-4 moved the shared rule onto the §8.1 token; assert the token is used
    // AND that its declared value is still the 2px ring.
    expect(focus).toContain('outline: var(--obe-focus-ring)');
    expect(CSS).toContain('--obe-focus-ring: 2px solid hsl(var(--ring))');
    expect(CSS).toContain('.obe-group-btn:focus-visible,\n.obe-cnt-add:focus-visible,\n.obe-tab:focus-visible,\n.obe-acc-toggle:focus-visible,');
    expect(ruleBody('.obe-group-btn')).toContain('width: var(--height-control-xs)');
    expect(ruleBody('.obe-group-btn')).toContain('height: var(--height-control-xs)');
    expect(ruleBody('.obe-acc-toggle')).toContain('height: var(--height-control-xs)');
    expect(ruleBody('.obe-cnt-add')).toContain('min-height: var(--height-control-xs)');
  });
});

describe('container surface equality', () => {
  it('uses full frame borders and the same divider alpha', () => {
    expect(ruleBody('.obe-group')).toContain('background: transparent');
    for (const selector of ['.obe-group', '.obe-cnt']) {
      expect(ruleBody(selector)).toContain('border: 1px solid hsl(var(--border))');
    }
    for (const selector of ['.obe-group-head', '.obe-cnt-head', '.obe-acc-section']) {
      expect(ruleBody(selector)).toContain('border-bottom: 1px solid hsl(var(--border) / 0.7)');
    }
    expect(ruleBody('.obe-group-locked').trim()).toBe('border-style: dashed;\n  border-color: hsl(var(--muted-foreground) / 0.45);');
    expect(ruleBody('.obe-cnt:has(> .obe-cnt-locked)').trim()).toBe('border-style: dashed;\n  border-color: hsl(var(--muted-foreground) / 0.45);');
    expect(CSS).not.toMatch(/\.obe-cnt-panel\.obe-cnt-locked[^}]*opacity/);
  });

  it('marks only the frame that owns a locked item, not its outer containers', () => {
    const host = document.createElement('div');
    host.innerHTML = '<section class="obe-cnt"><div class="obe-cnt-panel"><section class="obe-cnt"><div class="obe-acc-section obe-cnt-locked"></div></section></div></section>';
    const frames = host.querySelectorAll('.obe-cnt');
    const selector = '.obe-cnt:has(> .obe-cnt-locked)';
    expect(frames[0].matches(selector)).toBe(false);
    expect(frames[1].matches(selector)).toBe(true);

    host.innerHTML = '<section class="obe-cnt"><div class="obe-cnt-head"><div class="obe-tabs-strip"><button class="obe-tab obe-tab-on"></button><button class="obe-tab obe-tab-locked"></button></div></div><div class="obe-cnt-panel"></div></section>';
    const tabs = host.querySelector('.obe-cnt')!;
    expect(tabs.matches(selector)).toBe(false);
    const activeLocked = tabs.cloneNode(true) as HTMLElement;
    activeLocked.querySelector('.obe-cnt-panel')!.classList.add('obe-cnt-locked');
    expect(activeLocked.matches(selector)).toBe(true);
  });

  it('pairs the live green chip colours with providerless editor fallbacks', () => {
    expect(ruleBody('.obe-cnt-done').trim()).toBe('background: var(--data-green-chip-bg, var(--obe-bg-green)); color: var(--data-green-chip-fg, var(--obe-fg-green));');
    expect(ruleBody('.obe-acc-chevron')).toContain('transition: transform var(--motion-base) var(--ease-out-soft)');
    expect(ruleBody('.obe-acc-toggle[aria-expanded="true"] .obe-acc-chevron')).toContain('transform: rotate(90deg)');
  });
});
