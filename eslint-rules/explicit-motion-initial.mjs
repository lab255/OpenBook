/** Includes aliases and motion.create wrappers; spreads do not count as explicit. */
export default {rules: {'explicit-initial': {
  meta: {type: 'problem', schema: [], messages: {subset: 'Viewer/block motion must use LazyMotion + domAnimation and lazy m components; eager motion/domMax imports are forbidden.', initial: 'Motion components require an explicit initial prop (normally initial={false}) to prevent a second entrance.'}},
  create(context) {
    const factories = new Set(['motion', 'm']);
    const components = new Set();
    return {
      ImportDeclaration(node) {
        if (!/^motion\/react(?:-m)?$/.test(node.source.value)) return;
        for (const spec of node.specifiers) {
          if (['motion', 'domMax'].includes(spec.imported?.name) || (node.source.value === 'motion/react' && spec.type !== 'ImportSpecifier')) context.report({node: spec, messageId: 'subset'});
          if (['m', 'motion'].includes(spec.imported?.name) || node.source.value === 'motion/react-m') factories.add(spec.local.name);
        }
      },
      VariableDeclarator(node) {
        const call = node.init;
        if (call?.type === 'CallExpression' && (factories.has(call.callee.name) || factories.has(call.callee.object?.name))) components.add(node.id.name);
      },
      JSXOpeningElement(node) {
        const name = node.name;
        if (!(factories.has(name.object?.name) || components.has(name.name))) return;
        if (!node.attributes.some(attr => attr.type === 'JSXAttribute' && attr.name.name === 'initial')) context.report({node, messageId: 'initial'});
      },
    };
  },
}}};
