import {classRule} from './design-token-utils.mjs';
export const noRawZ = classRule('Use a named stacking tier.', value => !/(?:^|:)z-0!?$/.test(value) && /(?:^|:)-?z-(?:\d+|\[[^\]]+\])!?$/.test(value));
export default {rules: {'no-raw-z': noRawZ}};
