/** Check actual resolved build graphs, not textual references to vendored bytes.
 * The app exporter intentionally carries viewer JS as an inert ?raw asset.
 */
export function assertMotionBoundary(lane, ids) {
  const modules = [...ids].map(id => id.replaceAll('\\', '/'));
  const provider = modules.some(id => id.endsWith('/src/viewer/MotionProvider.tsx'));
  const appEntry = modules.some(id => id.endsWith('/packages/ui/src/index.ts'));
  if (lane === 'app' && provider) throw new Error('Viewer motion provider leaked into app module graph');
  if (lane === 'viewer' && (!provider || appEntry)) throw new Error('Viewer must include its motion provider and exclude the app entry');
}
export function motionBoundary(lane) {
  return {
    name: `openbook-motion-boundary-${lane}`,
    generateBundle() {
      assertMotionBoundary(lane, this.getModuleIds());
      this.info(`${lane} motion module boundary passed`);
    },
  };
}
