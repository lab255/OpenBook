// App registration seam: editing-only registrations belong here.
// The standalone viewer imports reactiveCore directly.
import {registerReactiveBlocks as registerCore} from './reactiveCore';
import {registerHistoryExtension} from './historyExtension';
import {CanvasHistory} from './canvas/history';

export function registerReactiveBlocks(): void {
  registerHistoryExtension((doc, canWrite) => new CanvasHistory(doc, canWrite));
  registerCore();
}
