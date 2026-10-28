/** Includes aliases and motion.create wrappers; spreads do not count as explicit. */
export default {rules: {'explicit-initial': {
  meta: {type: 'problem', schema: [], messages: {initial: 'Motion components require an explicit initial prop (normally initial={false}) to prevent a second entrance.'}},
  create(context) {
    const factories = new Set(['motion', 'm']);
    const components = new Set();
    const namespaces = new Set();
    const isFactory = node => factories.has(node?.name) || (namespaces.has(node?.object?.name) && ['m', 'motion'].includes(node?.property?.name));
    return {
      ImportDeclaration(node) {
        if (!/^motion\/react(?:-m)?$/.test(node.source.value)) return;
        for (const spec of node.specifiers) {
          if (node.source.value === 'motion/react' && spec.type === 'ImportNamespaceSpecifier') namespaces.add(spec.local.name);
          if (['m', 'motion'].includes(spec.imported?.name) || node.source.value === 'motion/react-m') factories.add(spec.local.name);
        }
      },
      VariableDeclarator(node) {
        const call = node.init;
        if (call?.type === 'CallExpression' && (isFactory(call.callee) || isFactory(call.callee.object))) components.add(node.id.name);
      },
      JSXOpeningElement(node) {
        const name = node.name;
        if (!(isFactory(name.object) || components.has(name.name))) return;
        if (!node.attributes.some(attr => attr.type === 'JSXAttribute' && attr.name.name === 'initial')) context.report({node, messageId: 'initial'});
      },
    };
  },
}}};
