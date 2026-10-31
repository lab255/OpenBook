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
  settings: source('../../SettingsPanel.tsx').match(/tab === id \? 'hover:bg-([\w-]+)'/)![1],
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

const sidebar = source('../../../lib/sidebarStyles.ts');
const sections = source('../../SidebarSections.tsx');
const overlay = source('../fluid-hover.tsx');
function assertChrome(sidebarSource: string, glideSource: string, styles: string) {
  expect(sidebarSource, 'sidebar: static hover fallback retained').toContain('SIDEBAR_HOVER,');
  expect(sidebarSource, 'sidebar: sheet-relative hover').toContain('bg-[hsl(var(--sheet-1-foreground)/0.06)]');
  expect(glideSource, 'sidebar: glide behind persistent fills').toContain('zIndex: -1');
  expect(styles, 'sidebar: unpositioned/static fallback survives').toContain(':has(> [data-fluid-hover-ready])');
  expect(styles, 'sidebar: active fill survives hover').toContain('[data-sidebar-page-row]:not(.bg-sidebar-selection-wash):hover');
}
describe('FF-4b pairwise chrome guards', () => {
  it('sidebar preserves background layering and fallback', () => assertChrome(sections, overlay, css));
  it('rejects erased fallback, app-relative hover, foreground glide, and active overwrite', () => {
    expect(() => assertChrome(sections.replaceAll('SIDEBAR_HOVER,', ''), overlay, css)).toThrow('static hover fallback');
    expect(() => assertChrome(sections.replace('bg-[hsl(var(--sheet-1-foreground)/0.06)]', 'bg-hover'), overlay, css)).toThrow('sheet-relative hover');
    expect(() => assertChrome(sections, overlay.replace('zIndex: -1', 'zIndex: 1'), css)).toThrow('behind persistent fills');
    expect(() => assertChrome(sections, overlay, css.replace(':not(.bg-sidebar-selection-wash)', ''))).toThrow('active fill survives');
  });
  for (const mode of ['tinted', 'accent', 'accent-dark']) {
    it(`${mode}: hover, active, selected hover are pairwise distinct`, () => {
      const block = mode === 'tinted' ? css : css.split(mode === 'accent' ? "[data-sidebar='accent'] .ob-accent-chrome {" : "[data-sidebar='accent'].dark .ob-accent-chrome {")[1].split('}')[0];
      const active = block.match(/--color-sidebar-selection-wash: ([^;]+);/)![1];
      const selected = block.match(/--color-sidebar-selection-wash-strong: ([^;]+);/)![1];
      const assertDistinct = (values: string[]) => expect(new Set(values).size, `${mode}: pairwise fills`).toBe(3);
      assertDistinct(['hsl(var(--sheet-1-foreground) / 0.06)', active, selected]);
      expect(() => assertDistinct([active, active, selected])).toThrow('pairwise fills');
      expect(sidebar).toContain('hover:bg-sidebar-selection-wash-strong');
    });
  }
});

it('settings chip retains a single token-timed hover target', () => {
  const chip = source('../../SettingsPanel.tsx').split('function ProfileChip')[1].split('export default')[0];
  expect(chip).toContain('duration-(--motion-fast) hover:bg-hover');
  expect(chip).not.toContain('FluidHover');
});
