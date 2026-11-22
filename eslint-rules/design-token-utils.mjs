// Match class-bearing JSX and hoisted style/class constants, as spacing does.
export function classContext(node) {
  for (let current = node.parent; current; current = current.parent) {
    if (current.type === 'JSXAttribute') return current.name.name === 'className';
    if (['JSXElement', 'JSXFragment'].includes(current.type)) return false;
    if (current.type === 'VariableDeclarator' && /class|style|motion/i.test(current.id.name ?? '')) return true;
    if (current.type === 'Property' && /class|style/i.test(current.key.name ?? current.key.value ?? '')) return true;
  }
  return false;
}
export function classRule(description, rejects, extra = () => ({})) {
  return {
    meta: {type: 'suggestion', docs: {description}, schema: [], messages: {token: '{{value}} must use a named design token.'}},
    create(context) {
      const report = (node, value) => context.report({node, messageId: 'token', data: {value}});
      function check(node, value) {
        if (!classContext(node)) return;
        for (const utility of value.split(/\s+/)) if (rejects(utility, context.filename)) report(node, utility);
      }
      const additional = extra(report);
      return {
        ...additional,
        Literal(node) {
          if (typeof node.value === 'string') check(node, node.value);
          additional.Literal?.(node);
        },
        TemplateLiteral(node) {
          check(node, node.quasis.map(q => q.value.cooked ?? q.value.raw).join('${}'));
        },
      };
    },
  };
}
