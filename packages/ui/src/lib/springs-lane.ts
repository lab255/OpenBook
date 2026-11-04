// Springs = interruptible chrome lane; index.css = export/viewer tween lane.
// Keep the two number sets separate: spring interruption preserves velocity,
// while CSS tweens and the shorter exit tweens deliberately settle on a clock.
// Registry-owned springs.ts stays pristine; put application-specific adapters here.
export {spring} from './springs';
