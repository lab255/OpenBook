import {LazyMotion, domAnimation} from 'motion/react';
import type {ReactNode} from 'react';

/** Post-hydration spring lane. strict rejects eager motion.* descendants. */
export function MotionProvider({children}: {children: ReactNode}) {
  return <LazyMotion features={domAnimation} strict>{children}</LazyMotion>;
}
