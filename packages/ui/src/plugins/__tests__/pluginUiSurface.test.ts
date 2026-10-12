import {describe, expect, it} from 'vitest';
// @ts-expect-error -- node:fs is available to Vitest, not the browser package.
import {readFileSync} from 'node:fs';
const css = readFileSync('src/index.css', 'utf8');
import manifest from '../../../../../docs/design/design-system-manifest-2026-10.md?raw';
import {PUBLIC_PLUGIN_UI_CLASSES} from '../uiSurface';

const surface = css.split('/* Plugin UI surface */')[1]?.split('/* End plugin UI surface */')[0] ?? '';

describe('public plugin UI surface', () => {
  it('defines and documents every stable class', () => {
    expect(surface.length).toBeGreaterThan(0);
    for (const name of PUBLIC_PLUGIN_UI_CLASSES) {
      expect(surface).toMatch(new RegExp(`\\.${name}(?=[\\s:{.,\\[])`));
      expect(manifest.split('## 14. Plugin UI surface')[1]).toContain(`\`${name}\``);
    }
  });

  it('uses theme and type tokens without hard-coded colours or rem font sizes', () => {
    expect(surface).not.toMatch(/#[\da-f]{3,8}\b|\brgba?\s*\(/i);
    expect(surface).not.toMatch(/font-size\s*:\s*[\d.]+rem\b/);
    expect(surface).not.toMatch(/\bopacity\s*:/);
  });
});
