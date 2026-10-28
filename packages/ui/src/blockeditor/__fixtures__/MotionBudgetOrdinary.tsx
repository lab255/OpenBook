// Test-only marginal-cost calibration; imported only by the calibration config.
import * as m from 'motion/react-m';
import {useState} from 'react';
import {spring} from '../../lib/springs-lane';
import {registerCustomBlock} from '../registry';
function MotionBudgetOrdinary() {
  const [on, setOn] = useState(false);
  return <m.button initial={false} animate={{x: on ? 40 : 0}} transition={spring.moderate} onClick={() => setOn(!on)}>Budget ordinary fixture</m.button>;
}
registerCustomBlock({type: 'ff6/budget-ordinary', render: MotionBudgetOrdinary});
