import {expect, it} from 'vitest';
// @ts-expect-error -- node:fs is available to Vitest, not the browser package.
import {readFileSync} from 'node:fs';

// Pinned verbatim from the @fluid registry configured in components.json:
// https://www.fluidfunctionalism.com/r/springs.json (2026-10-27).
// Upgrade only by re-pulling the registry item and updating both bytes together.
it('keeps registry springs byte-identical to the pinned upstream fixture', () => {
  const installed: Uint8Array = readFileSync('src/lib/springs.ts');
  const upstream: Uint8Array = readFileSync('src/lib/__fixtures__/fluid-springs.ts.txt');
  expect(installed).toEqual(upstream);
});
