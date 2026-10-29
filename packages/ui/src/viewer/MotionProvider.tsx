import * as m from 'motion/react-m';
import {LazyMotion, domAnimation} from 'motion/react';
import type {ReactNode} from 'react';

/** Export-viewer lane only. Non-strict also tolerates registry motion.* children.
 * Seed the shared lazy renderer here, rather than charging the first block.
 * The display-contents wrapper adds no layout box or entrance.
 * App chrome keeps its independent eager imports under the FF-1 owner ruling.
 */
export function MotionProvider({children}: {children: ReactNode}) {
  return <LazyMotion features={domAnimation}><m.div initial={false} style={{display: 'contents'}}>{children}</m.div></LazyMotion>;
}
