// @vitest-environment node
import {readFileSync} from 'node:fs';
import postcss from 'postcss';
import {describe, expect, it} from 'vitest';

const css = postcss.parse(readFileSync(new URL('../src/index.css', import.meta.url), 'utf8'));
const expected = {sm: '28px', lg: '36px', xs: '24px', md: '32px'};

describe('FF-7a pixel-neutral control ladder', () => {
  for (const mode of [':root', '.dark', '@theme']) {
    it(`declares and resolves all four steps in ${mode}`, () => {
      const tokens = new Map<string, string>();
      const collect = (node: postcss.Rule | postcss.AtRule) => {
        node.each(child => {
          if (child.type === 'decl' && child.prop.startsWith('--')) tokens.set(child.prop, child.value);
        });
      };
      if (mode === '@theme') css.walkAtRules('theme', collect);
      else css.walkRules(mode, collect);
      const resolve = (name: string, seen = new Set<string>()): string => {
        expect(seen.has(name), `cyclic alias: ${name}`).toBe(false);
        seen.add(name);
        const value = tokens.get(name);
        expect(value, `missing token: ${name}`).toBeDefined();
        return value!.replace(/var\((--[\w-]+)\)/g, (_, alias: string) => resolve(alias, new Set(seen)));
      };
      for (const [tier, value] of Object.entries(expected)) {
        expect(resolve(`--height-control-${tier}`)).toBe(value);
      }
    });
  }

  it('retains the independent export byte budgets and enforcement', () => {
    const ledger = JSON.parse(readFileSync(new URL('./motionFeatures.json', import.meta.url), 'utf8'));
    expect(ledger.blockOwnBytesCeiling).toBe(2048);
    expect(ledger.hardDeltaCeiling).toBe(262144);
    const guard = readFileSync(new URL('./motionGraph.mjs', import.meta.url), 'utf8');
    expect(guard).toContain('if (bytes > ledger.blockOwnBytesCeiling) throw new Error');
  });
});
