import {createRoot} from 'react-dom/client';
import {useState} from 'react';
import * as m from 'motion/react-m';
import {Select} from '../../components/ui/select';
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
  return <><m.button data-block-type="ff6/fixture" initial={false} animate={{x: moved ? 40 : 0}} transition={spring.moderate} onClick={() => setMoved(!moved)}>Move fixture</m.button>
    <Select value="one" aria-label="Seam select">
      <option value="one">First option</option><option value="two">Second option</option>
    </Select></>;
}

// Loaded ONLY by the dedicated test bundle entry, never by the product viewer.
export function installMotionFixture() {
  registerCustomBlock({type: 'ff6/fixture', render: MotionFixture});
  const style = document.createElement('style');
  style.textContent = entranceCss(':is(.ob-plugin-block, button)[data-block-type="ff6/fixture"]');
  document.head.appendChild(style);
  // Separate React root, deliberately outside the viewer's LazyMotion context.
  const standalone = () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    createRoot(host).render(<Select value="one" aria-label="Standalone select"><option value="one">First option</option><option value="two">Second option</option></Select>);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', standalone, {once: true});
  else standalone();
}
