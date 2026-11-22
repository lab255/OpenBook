// @ts-expect-error -- Vitest runs in Node; the browser package omits Node ambient types.
import {readFileSync} from 'node:fs';
const css = readFileSync('src/index.css', 'utf8');
import {describe, expect, it} from 'vitest';
import {DATA_COLOR_SCHEMES, DATA_COLOR_TOKENS, DATA_PALETTE} from '@book.dev/sdk';
import {DATA_CHIP_CLASS, dataColorCss} from '../dataColorVars';
import {STATUS_DOT_CLASS, STATUS_INK_CLASS, WARN_ICON_CLASS, WARN_SURFACE_CLASS} from '../statusStyles';

function luminance(rgb: number[]): number {
  const linear = rgb.map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

function hexLuminance(hex: string): number {
  return luminance([1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255));
}

describe('app status palette recipes', () => {
  it('provides a matched, statically discoverable chip pair for every token', () => {
    expect(Object.keys(DATA_CHIP_CLASS).sort()).toEqual([...DATA_COLOR_TOKENS].sort());
    for (const [token, recipe] of Object.entries(DATA_CHIP_CLASS)) {
      expect(recipe).toMatch(/^bg-\[var\(--data-(\w+)-chip-bg\)\] text-\[var\(--data-\1-chip-fg\)\]$/);
      expect(recipe).toContain(`--data-${token}-chip-bg`);
    }
  });

  it('resolves every data variable in the shared recipes', () => {
    const recipes = [...Object.values(DATA_CHIP_CLASS), ...Object.values(STATUS_INK_CLASS),
      ...Object.values(STATUS_DOT_CLASS), WARN_ICON_CLASS, WARN_SURFACE_CLASS].join(' ');
    const css = dataColorCss('pastel');
    for (const [name] of recipes.matchAll(/--data-[\w-]+/g)) expect(css).toContain(`${name}:`);
  });

  it('resolves warning chrome in root and dark mode, including inherited aliases', () => {
    const root = css.match(/:root\s*\{([^}]+)\}/)?.[1] ?? '';
    const dark = css.match(/\.dark\s*\{([^}]+)\}/)?.[1] ?? '';
    expect(root).toContain('--obe-callout-warn: var(--obe-bg-yellow)');
    for (const block of [root, dark]) {
      expect(block).toMatch(/--obe-fg-yellow:\s*hsl\(/);
      // The warning alias is inherited from root; its target flips in .dark.
      expect(block).toMatch(/--obe-bg-yellow:\s*hsl\(/);
    }
  });

  for (const scheme of DATA_COLOR_SCHEMES) {
    it(`${scheme} status inks meet AA on light and dark surfaces`, () => {
      // hsl(40 9% 96%) converted without rounding to 8-bit RGB.
      const muted = luminance([0.9636, 0.9612, 0.9564]);
      // hsl(40 14% 97.5%) converted without rounding to 8-bit RGB.
      const sheet1 = luminance([0.9785, 0.9761666666666667, 0.9715]);
      // hsl(0 0% 13%), hsl(0 0% 16.5%), and hsl(0 0% 18.5%).
      const darkSurfaces = [
        luminance([0.13, 0.13, 0.13]),
        luminance([0.165, 0.165, 0.165]),
        luminance([0.185, 0.185, 0.185]),
      ];
      for (const token of ['green', 'yellow', 'red'] as const) {
        const ink = hexLuminance(DATA_PALETTE[scheme][token].chip.light.fg);
        for (const surface of [1, muted, sheet1]) {
          expect((surface + 0.05) / (ink + 0.05), `${scheme}/${token}`).toBeGreaterThanOrEqual(4.5);
        }
        const darkInk = hexLuminance(DATA_PALETTE[scheme][token].chip.dark.fg);
        for (const surface of darkSurfaces) {
          expect((darkInk + 0.05) / (surface + 0.05), `${scheme}/${token}/dark`).toBeGreaterThanOrEqual(4.5);
        }
      }
    });
  }
});
