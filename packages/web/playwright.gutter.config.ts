import config from './playwright.config';

/** Uses the committed single-process launch recipe inherited from config.
 * A dedicated external data server avoids the shared 4400 port during parallel
 * worker evidence collection; its caller owns teardown, not the global sweeper.
 */
export default {
  ...config,
  testMatch: 'shared-gutter-prototype.spec.ts',
  ...(process.env.GUTTER_EVIDENCE_SERVER ? {globalTeardown: undefined} : {}),
  use: {...config.use, video: 'on' as const},
};
