import stylelint from 'stylelint';

const ruleName = 'design-tokens/export-parity';
const variables = value => [...value.matchAll(/var\(\s*(--[\w-]+)/g)].map(match => match[1]);
const tailwindNamespace = /^--(?:tw-|color-|font-|text-|tracking-|leading-|breakpoint-|container-|spacing(?:-|$)|radius-|shadow-|inset-shadow-|drop-shadow-|blur-|perspective-|aspect-|ease-|animate-|default-)/;
function inside(node, predicate) {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (predicate(parent)) return true;
  }
  return false;
}
const inTheme = node => inside(node, parent => parent.type === 'atrule' && parent.name === 'theme');
const inCore = node => inside(node, parent => parent.type === 'rule' && /\.obe-[\w-]+/.test(parent.selector));

export default stylelint.createPlugin(ruleName, enabled => (root, result) => {
  if (!enabled) return;
  // Static mirror files are declaration-only contracts, so guard their entire
  // dependency graph, including root declarations without an .obe-* consumer.
  const mirror = /[/\\]exportTokens(?:Dark)?\.css$/.test(root.source?.input.file ?? '');
  const theme = new Set();
  const plain = new Map();
  root.walkDecls(/^--/, decl => {
    if (inTheme(decl)) theme.add(decl.prop);
    else plain.set(decl.prop, [...(plain.get(decl.prop) ?? []), ...variables(decl.value)]);
  });
  // FF-6 mirrors plain root/dark declarations only. This deliberately does not
  // authorize Tailwind-generated dependencies, even through a plain alias.
  function generated(name, seen = new Set()) {
    if (seen.has(name)) return false;
    seen.add(name);
    if (name.startsWith('--tw-')) return true;
    if (plain.has(name)) return plain.get(name).some(ref => generated(ref, seen));
    return theme.has(name) || tailwindNamespace.test(name);
  }
  function report(node) {
    stylelint.utils.report({ruleName, result, node, severity: 'error',
      message: `Core block CSS must use plain export-mirrored tokens; Tailwind dependencies await FF-6: ${node.toString()}`});
  }
  root.walkDecls(decl => {
    if ((mirror || inCore(decl)) && variables(decl.value).some(name => generated(name))) report(decl);
  });
  root.walkAtRules('apply', node => { if (mirror || inCore(node)) report(node); });
});
