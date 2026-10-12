import {describe, expect, it} from 'vitest';
import {PUBLIC_PLUGIN_UI_CLASSES} from '../uiSurface';

const sources = import.meta.glob('../../../../../examples/plugins/ledger/src/*.{ts,tsx}', {
  query: '?raw', import: 'default', eager: true,
}) as Record<string, string>;
// Slice 9b/9c owners remove these entries as they migrate their files.
const laterSlices = new Set(['block.tsx', 'importBlock.tsx', 'register.tsx', 'reconcileBlock.tsx']);

describe('ledger public styles', () => {
  it('keeps migrated TSX free of private chrome recipes', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(0);
    for (const [path, source] of Object.entries(sources)) {
      if (!path.endsWith('.tsx') || laterSlices.has(path.split('/').pop()!)) continue;
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
