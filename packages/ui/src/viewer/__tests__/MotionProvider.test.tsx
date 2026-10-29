import {expect, it} from 'vitest';
import {cleanup, render} from '@testing-library/react';
import {LazyMotion, domAnimation, motion} from 'motion/react';
import {MotionProvider} from '../MotionProvider';

it('tolerates eager registry-style descendants; strict is the rejected control', () => {
  try {
    expect(() => render(<LazyMotion features={domAnimation} strict><motion.div initial={false}>Registry</motion.div></LazyMotion>)).toThrow(/strict|LazyMotion/);
    cleanup();
    const view = render(<MotionProvider><motion.div initial={false}>Registry</motion.div></MotionProvider>);
    expect(view.getByText('Registry')).toBeTruthy();
  } finally {
    cleanup();
  }
});
