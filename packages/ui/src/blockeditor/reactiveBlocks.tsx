// App registration seam: editing-only registrations belong here.
// The standalone viewer imports reactiveCore directly.
import {registerReactiveBlocks as registerCore} from './reactiveCore';
import {registerHistoryExtension} from './historyExtension';
import {registerPropsProjection} from './model';
import {projectCanvas} from './canvas/schema';
import {CanvasHistory} from './canvas/history';

export function registerReactiveBlocks(): void {
  registerHistoryExtension((doc, canWrite) => new CanvasHistory(doc, canWrite));
  registerPropsProjection('canvas', projectCanvas);
  registerCore();
}
