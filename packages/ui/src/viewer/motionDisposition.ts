/** Tier names describe intent. CSS is a tween; only the hydrated runtime uses springs.
 * A viewer disposition is deliberately absent from legacy exports and PDFs.
 * No product block adopts a new animation in FF-6.
 */
export interface MotionDisposition {
  name: string;
  category: 'load' | 'pointer' | 'state';
  exportSafe: 'css' | 'viewer' | false;
  reason: string;
  exportedObservable: string;
  tokens: readonly string[];
}
export function validateDisposition(entry: MotionDisposition): void {
  if (!entry.name || !['load', 'pointer', 'state'].includes(entry.category) || !['css', 'viewer', false].includes(entry.exportSafe)) throw new Error('Invalid motion disposition');
  if (!entry.reason.trim()) throw new Error(`${entry.name}: reason required`);
  if (entry.exportSafe === false && !entry.reason.includes('app surface:')) throw new Error(`${entry.name}: name the app surface`);
  if (entry.exportSafe !== false && !entry.exportedObservable.trim()) throw new Error(`${entry.name}: exportedObservable required`);
  if (entry.exportSafe === 'viewer' && !entry.reason.includes('absent in legacy + PDF')) throw new Error(`${entry.name}: viewer absence must be explicit`);
}
export const motionDispositions = [
  {name: 'legacy-progress', category: 'state', exportSafe: 'css', reason: 'Legacy reactive progress retains its CSS tween.', exportedObservable: 'Changing a legacy progress value tweens the fill width.', tokens: ['motion-base', 'ease-out-soft']},
  {name: 'slide-entrance', category: 'load', exportSafe: 'css', reason: 'Slide decks use the legacy CSS tween lane.', exportedObservable: 'The current slide fades and moves into place.', tokens: ['motion-slow', 'ease-out-soft']},
  {name: 'block-pointer-feedback', category: 'pointer', exportSafe: 'viewer', reason: 'Existing block control, chart and link CSS feedback; absent in legacy + PDF paths.', exportedObservable: 'Hovering a hydrated block control changes its paint without moving adjacent content.', tokens: ['motion-fast', 'ease-out-soft']},
  {name: 'block-state-feedback', category: 'state', exportSafe: 'viewer', reason: 'Existing knob, disclosure, progress and status CSS feedback; absent in legacy + PDF paths. No spring migration in FF-6.', exportedObservable: 'Hydrated disclosure chevrons rotate when opened.', tokens: ['motion-base', 'ease-out-soft']},
  {name: 'editor-presence', category: 'state', exportSafe: false, reason: 'app surface: collaborative editor remote cursors and locate feedback.', exportedObservable: '', tokens: ['motion-cursor-flash', 'motion-locate-flash']},
  {name: 'editor-menu-entrance', category: 'load', exportSafe: false, reason: 'app surface: editor context and slash menus.', exportedObservable: '', tokens: ['motion-base', 'ease-out-soft']},
] as const satisfies readonly MotionDisposition[];
