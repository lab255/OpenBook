import stylelint from 'stylelint';
const ruleName = 'design-tokens/role-values';
const radiusAtom = String.raw`(?:0|50%|9999px|var\(--(?:radius-(?:sm|md|lg|xl)|ob-page-radius)\))`;
const radius = new RegExp(`^${radiusAtom}(?:\\s+${radiusAtom}){0,3}$`);
const font = /^(?:var\(--obe-(?:font-size|[\w-]+-size|code-inline)\)|inherit|(?:0(?:\.\d+)?|1(?:\.0+)?)em)$/;
const z = /^(?:var\(--z-index-[\w-]+\)|0|auto|-1)$/;
export default stylelint.createPlugin(ruleName, enabled => (root, result) => {
  if (!enabled) return;
  root.walkDecls(decl => {
    const prop = decl.prop.toLowerCase();
    const pattern = prop === 'border-radius' ? radius : prop === 'z-index' ? z
      : prop === 'font-size' && /\.obe-[\w-]+/.test(decl.parent.selector ?? '') ? font : null;
    if (pattern && !pattern.test(decl.value)) stylelint.utils.report({
      ruleName, result, node: decl,
      message: `Use a DSX role token for ${prop}: ${decl.value}`,
    });
  });
});
