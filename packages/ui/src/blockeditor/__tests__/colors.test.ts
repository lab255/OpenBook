// @vitest-environment node
// @ts-expect-error -- Vitest runs in Node; the browser package omits Node ambient types.
import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {COLOR_EXPORT_HEX, COLOR_EXPORT_HEX_DARK, COLOR_TOKENS} from '../colors';

const css: string = readFileSync(new URL('../../index.css', import.meta.url), 'utf8');
const roles = ['fg', 'bg', 'hl'] as const;

// CSS HSL -> sRGB, retaining alpha so tints also match on nested surfaces.
function rgba(value: string): number[] {
  const match = /^(\d+(?:\.\d+)?) (\d+(?:\.\d+)?)% (\d+(?:\.\d+)?)%(?: \/ ([\d.]+))?$/.exec(value);
  if (!match) throw new Error(`Unsupported HSL: ${value}`);
  const h = Number(match[1]) / 30;
  const s = Number(match[2]) / 100;
  const l = Number(match[3]) / 100;
  const a = s * Math.min(l, 1 - l);
  const channel = (n: number) => {
    const k = (n + h) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [channel(0), channel(8), channel(4), Number(match[4] ?? 1)];
}

function literal(dark: boolean, role: typeof roles[number], id: string): string {
  const theme = css.match(dark ? /\.dark\s*\{([^}]+)\}/ : /:root\s*\{([^}]+)\}/)?.[1];
  const property = `--obe-${role}-${id}`;
  const value = theme?.match(new RegExp(`${property}: hsl\\(([^)]+)\\)`))?.[1];
  if (!value) throw new Error(`Missing ${dark ? '.dark' : ':root'} ${property}`);
  return value;
}

function hex(channels: number[]): string {
  const values = channels[3] === 1 ? channels.slice(0, 3) : channels;
  return '#' + values.map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
}

function luminance(channels: number[]): number {
  return channels.slice(0, 3).reduce((sum, c, i) =>
    sum + [0.2126, 0.7152, 0.0722][i] * (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4), 0);
}

function contrast(a: number[], b: number[]): number {
  const values = [luminance(a), luminance(b)];
  return (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05);
}

it('checks conversion and WCAG reference values', () => {
  expect(hex(rgba('0 100% 50%'))).toBe('#ff0000');
  expect(hex(rgba('120 100% 50% / 0.5'))).toBe('#00ff0080');
  expect(contrast(rgba('0 0% 0%'), rgba('0 0% 100%'))).toBe(21);
  expect(contrast(rgba('0 0% 50%'), rgba('0 0% 50%'))).toBe(1);
});

for (const dark of [false, true]) {
  const mode = dark ? 'dark' : 'light';
  const palette = dark ? COLOR_EXPORT_HEX_DARK : COLOR_EXPORT_HEX;
  // Read actual theme backgrounds, not duplicated test constants.
  const theme = css.match(dark ? /\.dark\s*\{([^}]+)\}/ : /:root\s*\{([^}]+)\}/)?.[1];
  const background = theme?.match(/--background:\s*([^;]+);/)?.[1];
  if (!background) throw new Error(`Missing ${mode} background`);
  describe(`${mode} editor palette`, () => {
    it('covers every palette token', () => {
      expect(Object.keys(palette).sort()).toEqual(COLOR_TOKENS.map(({id}) => id).sort());
      expect(COLOR_TOKENS).toHaveLength(9);
    });
    for (const {id} of COLOR_TOKENS) {
      it(`${id} text meets 4.5:1`, () => {
        expect(contrast(rgba(literal(dark, 'fg', id)), rgba(background))).toBeGreaterThanOrEqual(4.5);
      });
      it.each(roles)(`${id} %s matches export hex`, (role) => {
        expect(palette[id][role]).toBe(hex(rgba(literal(dark, role, id))));
      });
    }
  });
}
