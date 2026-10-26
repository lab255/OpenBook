// Springs = interruptible chrome lane; index.css = export/viewer tween lane.
// Keep the two number sets separate: spring interruption preserves velocity,
// while CSS tweens and the shorter exit tweens deliberately settle on a clock.
export const spring = {
  fast: {type: 'spring', duration: 0.08, bounce: 0, exit: {duration: 0.06}},
  moderate: {type: 'spring', duration: 0.16, bounce: 0, exit: {duration: 0.12}},
  slow: {type: 'spring', duration: 0.24, bounce: 0.12, exit: {duration: 0.16}},
} as const;
