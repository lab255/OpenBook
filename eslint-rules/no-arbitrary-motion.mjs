import {classRule} from './design-token-utils.mjs';
export const noArbitraryMotion = classRule('Use the DSX motion scale.', (value, filename) => {
  if (/(?:^|:)duration-0!?$/.test(value)) return false;
  if (/(?:^|:)ease-spring!?$/.test(value) && !/(?:^|\/)switch\.tsx$/.test(filename)) return true;
  if (/(?:^|:)zoom-(?:in|out)-95!?$/.test(value)) return !filename.endsWith('/overlay-motion.ts');
  return /(?:^|:)(?:(?:duration|delay)-(?:\d+|\[[^\]]+\])|ease-(?:in|out|in-out|linear|\[[^\]]+\])|animate-\[[^\]]+\])!?$/.test(value);
});
export default {rules: {'no-arbitrary-motion': noArbitraryMotion}};
