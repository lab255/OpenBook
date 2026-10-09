import {describe, expect, it} from 'vitest';
// @ts-expect-error -- node:fs is available to Vitest, not the browser package.
import {readFileSync} from 'node:fs';

const css: string = readFileSync('src/index.css', 'utf8');
const exporter: string = readFileSync('src/export/toHtml.ts', 'utf8');
const root = css.slice(css.indexOf('  :root {'), css.indexOf('  .dark {'));
const dark = css.slice(css.indexOf('  .dark {'), css.indexOf('\n  html,'));
function darkToken(name: string): string {
  const match = dark.match(new RegExp(`--${name}: ([^;]+);`));
  expect(match, name).not.toBeNull();
  return match![1];
}
function token(name: string): string {
  const match = root.match(new RegExp(`--${name}: ([^;]+);`));
  expect(match, name).not.toBeNull();
  return match![1];
}

describe('DSX foundation export mirrors', () => {
  it('keeps the static type ramp equal to the plain CSS tokens', () => {
    const body = parseFloat(token('obe-font-size'));
    expect(exporter).toContain(`font: ${body}px/${token('obe-leading')} `);
    for (const [name, selector] of [['h1', 'h1'], ['h2', 'h2'], ['h3', 'h3'], ['title', 'h1.doc-title']] as const) {
      const ratio = Number(token(`obe-${name}-size`).match(/\* ([\d.]+)/)![1]);
      expect(exporter).toContain(`${selector} { font-size: ${body * ratio}px;`);
      if (name !== 'title') expect(exporter).toContain(`margin-top: ${token(`obe-${name}-space`)};`);
    }
    expect(exporter).toContain(`font-weight: ${token('obe-heading-weight')}; line-height: ${token('obe-h1-leading')};`);
    expect(exporter).toContain(`font-family: ${token('obe-font-mono')}; font-size: ${token('obe-code-inline')};`);
    const codeRatio = Number(token('obe-code-size').match(/\* ([\d.]+)/)![1]);
    expect(exporter).toContain(`pre code { font-size: ${body * codeRatio}px; line-height: ${token('obe-code-leading')}; }`);
  });

  it('mirrors borderless callout tints and supports authored warn plus legacy warning', () => {
    expect(exporter).toContain(`.callout { background: hsl(${token('muted')}); }`);
    const dual = exporter.slice(exporter.indexOf('const SCHEME_DUAL ='), exporter.indexOf('const stylesFor ='));
    expect(dual).toContain(`.callout { background: hsl(${darkToken('muted')}); }`);
    for (const [variant, hue] of [['warn', 'yellow'], ['success', 'green'], ['danger', 'red']]) {
      expect(token(`obe-callout-${variant}`)).toBe(`var(--obe-bg-${hue})`);
      const selector = variant === 'warn' ? '.callout[data-variant=warn], .callout[data-variant=warning]' : `.callout[data-variant=${variant}]`;
      expect(exporter).toContain(`${selector} { background: ${token(`obe-bg-${hue}`)}; }`);
    }
    expect(exporter).toContain('.callout[data-variant=warn], .callout[data-variant=warning]');
    expect(exporter).toContain('padding: 12px; border-radius: 8px; border: none; }');
  });

  it('declares every palette role and syntax hue in both modes', () => {
    for (const role of ['fg', 'bg', 'hl']) {
      for (const hue of ['gray', 'brown', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'red']) {
        expect(token(`obe-${role}-${hue}`)).toMatch(/^hsl\(/);
        expect(dark).toContain(`--obe-${role}-${hue}: hsl(`);
      }
    }
    for (const hue of ['kw', 'str', 'num', 'lit']) expect(dark).toContain(`--obe-code-${hue}: hsl(`);
    expect(token('obe-code-num')).toBe('hsl(28 80% 38%)');
  });
});
