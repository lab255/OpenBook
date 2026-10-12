import {describe, expect, it} from 'vitest';
import {PUBLIC_PLUGIN_UI_CLASSES} from '../uiSurface';

const sources = import.meta.glob('../../../../../examples/plugins/ledger/src/*.{ts,tsx}', {
  query: '?raw', import: 'default', eager: true,
}) as Record<string, string>;
// All ledger surfaces have migrated; no file may retain a legacy recipe.
const laterSlices = new Set<string>();

describe('ledger public styles', () => {
  it('keeps migrated TSX free of private chrome recipes', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(0);
    for (const [path, source] of Object.entries(sources)) {
      if (laterSlices.has(path.split('/').pop()!)) continue;
      expect(source, path).not.toMatch(/\b(legacyStyles|SECONDARY_TEXT|frameStyle|titleStyle|mutedStyle|controlStyle|buttonStyle|disabledButtonStyle|tableStyle|thStyle|tdStyle|numericStyle|numericHeadStyle|noticeStyle)\b/);
      if (!path.endsWith('.tsx')) continue;
      expect(source, path).not.toMatch(/hsl\(var\(--|fontSize\s*:|borderRadius\s*:|fontWeight\s*:\s*5|SECONDARY_TEXT/);
    }
  });

  it('uses only registered public classes throughout the plugin', () => {
    const classes = new Set<string>(PUBLIC_PLUGIN_UI_CLASSES);
    for (const [path, source] of Object.entries(sources)) {
      for (const match of source.matchAll(/\bobe-ui-[a-z-]+/g)) {
        expect(classes.has(match[0]), `${path}: ${match[0]}`).toBe(true);
      }
    }
  });
});
