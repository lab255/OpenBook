// Negative feature-ledger control; never included by the production entry.
import {motion} from 'motion/react';
import {registerCustomBlock} from '../registry';
function MotionBudgetLayout() {
  return <motion.div initial={false} layout>Budget layout fixture</motion.div>;
}
registerCustomBlock({type: 'ff6/budget-layout', render: MotionBudgetLayout});
