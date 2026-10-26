import {describe, expect, it} from 'vitest';
import type {Transition} from 'motion/react';
import {spring} from './springs';

describe('FF interruptible chrome springs', () => {
  it.each([
    ['fast', 0.08, 0, 0.06],
    ['moderate', 0.16, 0, 0.12],
    ['slow', 0.24, 0.12, 0.16],
  ] as const)('%s enters with a real spring and exits with a duration-only tween', (tier, duration, bounce, exit) => {
    const transition = spring[tier] satisfies Transition;
    expect(transition.type).toBe('spring');
    expect(transition.duration).toBe(duration);
    expect(transition.bounce).toBe(bounce);
    expect(transition.exit).toEqual({duration: exit});
    expect(transition.exit).not.toHaveProperty('type');
    expect(transition.exit).not.toHaveProperty('bounce');
  });
});
