// @vitest-environment node
// @ts-expect-error -- node:fs is available to Vitest, not the browser package.
import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const hover = source('../fluid-hover.tsx').match(/\bbg-(hover(?:-strong)?)\b/)![1];
const css = source('../../../index.css');
const pairs = {
  dropdown: source('../dropdown-menu.tsx').match(/data-\[state=checked\]:bg-([\w-]+)/)![1],
  select: source('../select.tsx').match(/current && "bg-([\w-]+)"/)![1],
  command: source('../command.tsx').match(/aria-\[current=page\]:bg-([\w-]+)/)![1],
  form: css.match(/--obe-chrome-active: var\(--([\w-]+)\)/)![1],
};
function assertPair(surface: string, active: string) {
  expect(hover, `${surface}: hover overlay must differ from persistent active`).not.toBe(active);
}
describe('FF-4 pairwise hover ≠ active', () => {
  for (const [surface, active] of Object.entries(pairs)) {
    it(`${surface}: distinct tokens`, () => assertPair(surface, active));
    it(`${surface}: rejects the token-flipped fixture naming the surface`, () => {
      expect(() => assertPair(surface, hover)).toThrow(`${surface}: hover overlay must differ`);
    });
  }
  it('form active binding uses the guarded token', () => {
    expect(css).toContain('.obe-form-palette-item[data-active] { background: var(--obe-chrome-active); }');
  });
});
