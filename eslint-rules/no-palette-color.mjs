import {classRule} from './design-token-utils.mjs';
const colorKey = /^(?:color|background(?:Color)?|border(?:Top|Right|Bottom|Left)?(?:Color)?|outline(?:Color)?|fill|stroke|boxShadow|caretColor|textDecorationColor|accentColor)$/;
const literal = /#[\da-f]{3,8}\b|\b(?:rgba?|hsla?)\(\s*[\d.]/i;
export const noPaletteColor = classRule('Use semantic editor or data colours.', value =>
  /(?:^|:)(?:bg|text|border(?:-[trblxyse])?|ring(?:-offset)?|fill|stroke|outline|from|via|to|decoration|caret|accent)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}(?:\/[^\s]+)?!?$/.test(value)
  || /(?:^|:)(?:bg|text|border(?:-[trblxyse])?|ring|fill|stroke|outline|from|via|to|decoration|caret|accent)-\[/.test(value) && literal.test(value), report => ({
  Literal(node) {
    if (typeof node.value !== 'string' || !literal.test(node.value)) return;
    const property = node.parent;
    if (property.type !== 'Property' || !colorKey.test(property.key.name ?? property.key.value ?? '')) return;
    for (let parent = property.parent; parent; parent = parent.parent) {
      if (parent.type === 'JSXAttribute') {
        if (parent.name.name === 'style') report(node, node.value);
        return;
      }
    }
  },
}));
export default {rules: {'no-palette-color': noPaletteColor}};
