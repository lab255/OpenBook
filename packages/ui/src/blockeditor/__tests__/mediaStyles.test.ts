// @vitest-environment node
// @ts-expect-error -- node:fs is available to Vitest, not the browser package.
import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';

const css = readFileSync(new URL('../../index.css', import.meta.url), 'utf8');
const rule = (selector: string): string => {
  const start = css.indexOf(`${selector} {`);
  expect(start, selector).toBeGreaterThanOrEqual(0);
  return css.slice(start, css.indexOf('}', start));
};

describe('media design contracts', () => {
  it('declares the exact manifest chrome and focus values (semantic aliases inherit dark values)', () => {
    for (const [token, value] of Object.entries({
      '--obe-chrome-hover': 'var(--hover)', '--obe-chrome-active': 'var(--hover-strong)',
      '--obe-chrome-ink-hover': 'hsl(var(--foreground))',
      '--obe-focus-ring': '2px solid hsl(var(--ring))', '--obe-focus-offset': '2px',
    })) {
      expect(css.match(new RegExp(`${token}: ([^;]+);`))?.[1]).toBe(value);
    }
    const focus = css.slice(css.indexOf('/* Block editor: keyboard focus visibility'), css.indexOf('/* Block editor: reactive custom blocks'));
    expect(focus).toContain('.obe-media-btn:focus-visible');
    expect(focus).toContain('outline: var(--obe-focus-ring)');
    expect(focus).toContain('outline-offset: var(--obe-focus-offset)');
  });

  it('places media controls above selection wash without intervening stacking contexts', () => {
    const resolveZ = (selector: string): number => {
      const token = rule(selector).match(/z-index: var\((--[^)]+)\)/)?.[1];
      expect(token).toBeTruthy();
      return Number(css.match(new RegExp(`${token}: (\\d+);`))?.[1]);
    };
    expect(resolveZ('.obe-row-selected::before')).toBe(3);
    for (const selector of ['.obe-media-bar', '.obe-image-resize', '.obe-artifact-resize']) {
      expect(resolveZ(selector)).toBe(4);
      expect(resolveZ(selector)).toBeGreaterThan(resolveZ('.obe-row-selected::before'));
    }
    // Audited DOM chains: blockbody → figure/frame, artifact/frame, or codeblock.
    for (const selector of ['.obe-blockbody', '.obe-image', '.obe-image-frame', '.obe-artifact', '.obe-artifact-frame', '.obe-codeblock']) {
      expect(rule(selector)).not.toMatch(/(?:z-index|transform|filter|opacity|isolation|contain|will-change):/);
    }
    expect(rule('.obe-media-bar[data-surface=\'plain\']')).toContain('top: 4px; right: 4px');
  });

  it('uses popover surfaces and menu shadows for lightbox chrome', () => {
    for (const selector of ['.obe-lightbox-zoombar', '.obe-lightbox-close']) {
      expect(rule(selector)).toContain('background: hsl(var(--popover))');
      expect(rule(selector)).toContain('box-shadow: var(--shadow-menu)');
      expect(rule(selector)).toContain('border: 0');
    }
  });

  it('reveals on deepest hover, keyboard focus, open menus and selection including touch', () => {
    expect(rule('.obe-media-bar')).toContain('pointer-events: none');
    expect(css).toContain(`.obe-row:hover:not(:has(.obe-row:hover)) > .obe-blockbody .obe-media-bar,
.obe-media-bar:focus-within,
.obe-media-bar:has([data-state='open']),
.obe-row-selected .obe-media-bar { opacity: 1; pointer-events: auto; }`);
    expect(css).toContain('@media (hover: none) { .obe-row-selected .obe-media-bar');
    for (const root of [':is(.ob-present, .ob-viewer)', '.obe-root.obe-readonly']) {
      expect(css).toContain(`${root} .obe-media-btn[data-chrome='author']`);
      expect(css).not.toContain(`${root} .obe-media-btn[data-chrome='view']`);
    }
  });

  it('keeps zoom controls and caption in separate flex rows, with a shrinking stage', () => {
    const bar = rule('.obe-lightbox-zoombar');
    expect(bar).toContain('position: static');
    expect(bar).toContain('flex: none');
    expect(bar).not.toContain('bottom:');
    expect(rule('.obe-lightbox-caption')).toContain('flex: 0 0 auto');
    expect(rule('.obe-lightbox-stage')).toContain('min-height: 0');
    const component = readFileSync(new URL('../../components/ImageLightbox.tsx', import.meta.url), 'utf8');
    expect(component.indexOf('className="obe-lightbox-caption"')).toBeLessThan(component.indexOf('className="obe-lightbox-zoombar"'));
    expect(rule('.obe-lightbox-zoombtn')).toContain('var(--height-control-md)');
    expect(rule('.obe-lightbox-close')).toContain('var(--height-control-lg)');
  });

  it('confines scrolling to text and reserves the same toolbar geometry for either wrap mode', () => {
    expect(rule('.obe-codeblock[data-wrap=\'false\'] .obe-text')).toContain('white-space: pre; overflow-x: auto');
    expect(rule('.obe-codeblock')).toContain('padding: calc(var(--obe-gutter-btn) + 0.5rem) 1rem 1rem');
    expect(rule('.obe-codeblock')).not.toContain('overflow');
    expect(rule('.obe-row[data-block-type=\'code\']')).toContain('calc(var(--obe-block-pad-y) + 1px + var(--obe-gutter-btn) + 0.5rem)');
    // First line centre = block pad + border + top inset + half line height.
    const blockPad = 4, border = 1, button = 24, inset = button + 8, line = 14 * 1.5;
    const gutterTop = blockPad + border + inset + (line - button) / 2;
    expect(gutterTop + button / 2).toBe(blockPad + border + inset + line / 2);
  });
});
