// @vitest-environment node
import {readFileSync} from 'node:fs';
import postcss from 'postcss';
import {describe, expect, it} from 'vitest';
import {buttonVariants} from '../src/components/ui/button';
import {inputVariants} from '../src/components/ui/input';
import {toHtml} from '../src/export/toHtml';

const app = postcss.parse(readFileSync('src/index.css', 'utf8'));
const viewer = readFileSync('src/export/vendor/openbook-viewer.js', 'utf8');
const exported = postcss.parse(JSON.parse(viewer.match(/s\.textContent=("(?:\\.|[^"\\])*");/)![1]));
const html = toHtml({editorjs: {blocks: []}, values: [], names: []}, 'Control parity', '');
const legacy = postcss.parse(html.match(/<style[^>]*>([\s\S]*?)<\/style>/)![1]);
const canonical = (selector: string) => selector.replace(/[\s'"]/g, '');
function value(css: postcss.Root, selector: string, prop: string): string | undefined {
  let found: string | undefined;
  css.walkRules(rule => {
    if (canonical(rule.selector) === canonical(selector) || rule.selectors.some(item => canonical(item) === canonical(selector))) rule.walkDecls(prop, decl => { found = decl.value; });
  });
  return found;
}
function resolve(css: postcss.Root, raw: string): string {
  return raw.replace(/var\((--[\w-]+)\)/g, (_, token: string) => {
    const literal = value(css, ':root', token);
    expect(literal, token).toBeDefined();
    return resolve(css, literal!);
  }).replace(/\b0\./g, '.').replace(/\s+/g, '');
}

describe('FF-7c control geometry and G2 export equality', () => {
  it.each([
    ['default', 'lg'], ['xs', 'sm'], ['sm', 'sm'], ['lg', 'lg'], ['icon', 'lg'],
  ] as const)('puts Button %s on the %s step', (size, tier) => {
    expect(buttonVariants({size}).split(' ')).toContain(`h-control-${tier}`);
    expect(buttonVariants({size})).not.toMatch(/\bh-(?:8|9|10)\b/);
  });
  it('pairs default and dense inputs with 36/28px buttons', () => {
    expect(inputVariants()).toContain('h-control-lg');
    expect(inputVariants({inputSize: 'sm'})).toContain('h-control-sm');
    expect(buttonVariants({size: 'icon'})).toContain('w-control-lg');
  });
  it('mirrors every kit/public-control height into the actual shipped viewer CSS', () => {
    let compared = 0;
    app.walkRules(rule => {
      if (!/\.obe-(?:kit-|ui-(?:btn|field|file))/.test(rule.selector)) return;
      rule.walkDecls(/^(?:min-|max-)?height$/, decl => {
        for (const selector of rule.selectors) {
          const shipped = value(exported, selector, decl.prop);
          expect(shipped, `${selector}: ${decl.prop}`).toBeDefined();
          expect(resolve(exported, shipped!)).toBe(resolve(app, value(app, selector, decl.prop)!));
        }
        compared++;
      });
    });
    expect(compared).toBeGreaterThan(20);
    for (const [tier, px] of [['sm', '28px'], ['lg', '36px'], ['xs', '24px'], ['md', '32px']]) {
      expect(value(exported, ':root', `--height-control-${tier}`)).toBe(px);
      expect(value(exported, '.dark', `--height-control-${tier}`)).toBe(px);
    }
  });
  it.each([
    ['.obe-kit-textinput', 'height', '.kitinput select, .kitinput input[type=text]'],
    ['.obe-kit-select', 'height', '.kitinput select'],
    ['.obe-kit-wide .obe-kit-dropdown-select', 'height', '.kit-wide select'],
    ['.obe-kit-action', 'height', '.kit-btn'],
    ['.obe-kit-action', 'height', '.ob-form > button'],
    ['.obe-kit-pill', 'min-height', '.kit-pill'],
    ['.obe-kit-wide .obe-kit-pill, .obe-kit-wide .obe-kit-check', 'min-height', '.kit-wide .kit-pill, .kit-wide .kit-check'],
    ['.obe-form-field input:not([type=checkbox]):not([type=range]), .obe-form-field select:not([multiple])', 'height', '.ob-form-field input:not([type=checkbox]):not([type=range]), .ob-form-field select:not([multiple])'],
  ])('mirrors %s as an export literal', (selector, prop, mirror) => {
    const px = resolve(app, value(app, selector, prop)!);
    expect(px).toMatch(/^(28|36)px$/);
    expect(value(legacy, mirror, prop)).toBe(px);
  });
});
