// App registration seam: editing-only registrations belong here.
// The standalone viewer imports reactiveCore directly.
import {registerReactiveBlocks as registerCore} from './reactiveCore';

export function registerReactiveBlocks(): void {
  registerCore();
}
