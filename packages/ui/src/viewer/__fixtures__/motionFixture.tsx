import {useState} from 'react';
import * as m from 'motion/react-m';
import {spring} from '../../lib/springs-lane';
import {registerCustomBlock} from '../../blockeditor/registry';
import {entranceCss} from '../entranceCss';
import type {MotionDisposition} from '../motionDisposition';

export const fixtureDispositions = [
  {name: 'fixture-entrance', category: 'load', exportSafe: 'css', reason: 'Test-only first-paint tween; the same block becomes a spring surface after hydration.', exportedObservable: 'The FF6 fixture card moves upward and fades in once before hydration.', tokens: ['motion-base', 'ease-out-soft']},
  {name: 'fixture-state', category: 'state', exportSafe: 'viewer', reason: 'Test-only spring interaction; absent in legacy + PDF paths.', exportedObservable: 'Clicking Move fixture moves the hydrated fixture 40 pixels to the right.', tokens: []},
] as const satisfies readonly MotionDisposition[];

export function MotionFixture() {
  const [moved, setMoved] = useState(false);
  return <m.button data-block-type="ff6/fixture" initial={false} animate={{x: moved ? 40 : 0}} transition={spring.moderate} onClick={() => setMoved(!moved)}>Move fixture</m.button>;
}

// Loaded ONLY by the dedicated test bundle entry, never by the product viewer.
export function installMotionFixture() {
  registerCustomBlock({type: 'ff6/fixture', render: MotionFixture});
  const style = document.createElement('style');
  style.textContent = entranceCss(':is(.ob-plugin-block, button)[data-block-type="ff6/fixture"]');
  document.head.appendChild(style);
}
