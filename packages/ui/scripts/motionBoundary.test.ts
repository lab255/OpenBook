import {expect, it} from 'vitest';
import {assertMotionBoundary} from './motionBoundary.mjs';

it('keeps the app and viewer motion strategies in separate resolved module graphs', () => {
  const app = '/repo/packages/ui/src/index.ts';
  const provider = '/repo/packages/ui/src/viewer/MotionProvider.tsx';
  const raw = '/repo/packages/ui/src/export/vendor/openbook-viewer.js?raw';
  expect(() => assertMotionBoundary('app', [app, raw])).not.toThrow();
  expect(() => assertMotionBoundary('viewer', [provider])).not.toThrow();
  expect(() => assertMotionBoundary('app', [app, provider])).toThrow('leaked into app');
  expect(() => assertMotionBoundary('viewer', [provider, app])).toThrow('exclude the app entry');
  expect(() => assertMotionBoundary('viewer', [])).toThrow('include its motion provider');
  process.stdout.write('BOUNDARY app/provider leak RED; viewer/app-entry leak RED; separate graphs GREEN\n');
});
