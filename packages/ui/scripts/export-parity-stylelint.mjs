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
  const theme = new Set();
  const plain = new Map();
  root.walkDecls(/^--/, decl => {
    if (inTheme(decl)) theme.add(decl.prop);
    else plain.set(decl.prop, [...(plain.get(decl.prop) ?? []), ...variables(decl.value)]);
  });
  // TODO(FF-6): widen with the approved export-mirror token allowlist and parity
  // tests. Until then, no Tailwind-generated dependency (even via an alias).
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
    if (inCore(decl) && variables(decl.value).some(name => generated(name))) report(decl);
  });
  root.walkAtRules('apply', node => { if (inCore(node)) report(node); });
});
