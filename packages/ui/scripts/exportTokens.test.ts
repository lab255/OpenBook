// @vitest-environment node
import {readFileSync} from 'node:fs';
import postcss from 'postcss';
import stylelint from 'stylelint';
import {describe, expect, it} from 'vitest';
import exportParity from './export-parity-stylelint.mjs';
import {toHtml, toHtmlSite, toSlideDeck} from '../src/export/toHtml';
import {paritySiteBundle} from '../src/export/__tests__/parityFixtureDoc';

const live = postcss.parse(readFileSync('src/index.css', 'utf8'));
const lightSource = readFileSync('src/export/exportTokens.css', 'utf8');
const darkSource = readFileSync('src/export/exportTokensDark.css', 'utf8');
const tweenNames = ['--motion-fast', '--motion-base', '--motion-slow', '--ease-out-soft', '--ease-in-out-soft'];
function declarations(css: postcss.Root, selector: string, inMedia = false): Record<string, string> {
  const result: Record<string, string> = {};
  css.walkRules(rule => {
    if (rule.selector !== selector) return;
    const media = rule.parent?.type === 'atrule' && rule.parent.name === 'media';
    if (media !== inMedia) return;
    rule.each(node => {
      if (node.type === 'decl' && node.prop.startsWith('--')) result[node.prop] = node.value;
    });
  });
  return result;
}
const light = declarations(live, ':root');
const dark = declarations(live, '.dark');
const legacy = {editorjs: {blocks: [{type: 'paragraph', data: {text: 'Token parity'}}]}, values: [], names: []};
const hydrated = {editor: 'blocks' as const, blockdoc: {v: 1 as const, blocks: [{id: 'p', type: 'paragraph', text: [{t: 'Token parity'}]}]}};
const styles = (html: string) => postcss.parse(html.match(/<style[^>]*>([\s\S]*?)<\/style>/)![1]);
const emissions = [
  ['legacy page', styles(toHtml(legacy, 'Tokens', '')), true],
  ['hydrated page first paint', styles(toHtml(hydrated, 'Tokens', '')), false],
  ['slide deck', styles(toSlideDeck(legacy, 'Tokens', '')), true],
] as const;
const normalize = (value: string) => value.replace(/\s+/g, ' ').trim();
function assertValues(actual: Record<string, string>, expected: Record<string, string>) {
  for (const [name, value] of Object.entries(expected)) {
    expect(actual[name] === undefined ? undefined : normalize(actual[name]), name).toBe(normalize(value));
  }
}

describe('FF-6 full plain-CSS export token mirror (G2)', () => {
  it('requires an explicit mirror for every root token and dark override, and nothing extra', () => {
    expect(declarations(postcss.parse(lightSource), ':root')).toEqual(Object.fromEntries(Object.entries(light).filter(([name]) => !tweenNames.includes(name))));
    expect(declarations(postcss.parse(darkSource), ':root')).toEqual(dark);
    // No implicit opt-in when a new @theme alias appears, even if its value is
    // literal-looking. Only independent plain declarations define this contract.
    live.walkAtRules('theme', theme => theme.each(node => {
      if (node.type === 'decl' && !(node.prop in light)) {
        expect(lightSource + darkSource, node.prop).not.toContain(`${node.prop}:`);
      }
    }));
  });

  it.each(emissions)('%s emits every live value in the correct scheme', (_name, css, dual) => {
    assertValues(declarations(css, ':root'), light);
    if (dual) {
      const overrides = declarations(css, ':root', true);
      assertValues(overrides, dark);
      assertValues({...declarations(css, ':root'), ...overrides}, {...light, ...dark});
    } else {
      expect(declarations(css, ':root', true)).toEqual({});
    }
  });

  it('covers both hydrated and legacy site runtime selection', async () => {
    const bundle = await paritySiteBundle();
    for (const asLegacy of [false, true]) {
      if (asLegacy) bundle.space.pages[0].data = legacy;
      const css = styles(toHtmlSite(bundle));
      assertValues(declarations(css, ':root'), light);
      if (asLegacy) assertValues(declarations(css, ':root', true), dark);
      else expect(declarations(css, ':root', true)).toEqual({});
    }
  });

  it('rejects a 1px drift in an emitted mirror while the app token stays fixed', () => {
    const actual = declarations(emissions[0][1], ':root');
    expect(() => assertValues({...actual, '--height-control-sm': '29px'}, light)).toThrow('--height-control-sm');
    assertValues(actual, light);
  });

  it('has only closed plain-CSS dependencies and no consuming rules', () => {
    for (const source of [lightSource, darkSource]) {
      const css = postcss.parse(source);
      css.walkRules(rule => expect(rule.selector).toBe(':root'));
      css.walkAtRules(rule => { throw new Error(`Unexpected @${rule.name} in token mirror`); });
      css.walkDecls(decl => {
        expect(decl.prop).toMatch(/^--/);
        for (const match of decl.value.matchAll(/var\(\s*(--[\w-]+)/g)) expect(light, match[1]).toHaveProperty(match[1]);
      });
    }
  });

  it.each(['exportTokens.css', 'exportTokensDark.css'])('keeps the Tailwind guard active throughout %s', async file => {
    // A real utility written literally here would be scanned into viewer CSS.
    const utility = ['bg', 'red', '500'].join('-');
    for (const declaration of ['color: var(--tw-shadow-color)', '--alias: var(--color-red-500)', '--alias: var(--font-sans)', `@apply ${utility}`]) {
      const result = await stylelint.lint({
        code: `:root { ${declaration}; }`, codeFilename: `src/export/${file}`,
        config: {plugins: [exportParity], rules: {'design-tokens/export-parity': true}},
      });
      expect(result.errored, declaration).toBe(true);
      expect(result.results[0].warnings.some(w => w.rule === 'design-tokens/export-parity' && w.severity === 'error')).toBe(true);
    }
  });
});
