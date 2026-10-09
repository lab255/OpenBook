import designTokens from './scripts/design-token-stylelint.mjs';
const gridPx = String.raw`-?(?:4|6|8|10|12|16|20|24|28|32|36|40|44|48|56|64|80|96|112|128|144|160|176|192|208|224|240|256|288|320|384)px`;
const gridRem = String.raw`-?(?:0\.25|0\.375|0\.5|0\.625|0\.75|1|1\.25|1\.5|1\.75|2|2\.25|2\.5|2\.75|3|3\.5|4|5|6|7|8|9|10|11|12|13|14|15|16|18|20|24)rem`;
const variable = String.raw`var\([^)]*\)`;
const number = String.raw`-?(?:[0-9]*\.)?[0-9]+`;
const calcInitialAtom = String.raw`(?:${gridPx}|${gridRem}|${variable})`;
const calcOperand = String.raw`(?:${gridPx}|${gridRem}|${number}|${variable})`;
const calculation = String.raw`calc\(\s*${calcInitialAtom}(?:\s+[-+*/]\s+${calcOperand})*\s*\)`;
const percentage = String.raw`-?(?:[0-9]*\.)?[0-9]+%`;
const spacingAtom = String.raw`(?:0|auto|${gridPx}|${gridRem}|${percentage}|${variable}|${calculation})`;
const spacingValue = `/^${spacingAtom}(?:\\s+${spacingAtom}){0,3}$/`;
export default {
  plugins: [designTokens],
  // The package script intentionally passes only src/index.css; generated CSS
  // and component-local styles are owned by other spacing clusters.
  rules: {
    // DSX warn-only baseline at foundation input: durations 44, easings ~40,
    // literal colours 99, radius 84, editor font sizes ~120, z-index 1.
    'design-tokens/role-values': [true, {severity: 'warning'}],
    'declaration-property-value-disallowed-list': [{
      '/^(transition|animation)(-duration|-delay)?$/': [
        '/(?<![\\w.-])(?:[1-9]\\d*(?:\\.\\d+)?|0?\\.\\d+)m?s\\b/',
        '/(?<![\\w-])ease(?:-in-out|-in|-out)?(?![\\w-])/',
        '/cubic-bezier\\(/',
      ],
      '/^(transition|animation)-timing-function$/': [
        '/(?<![\\w-])ease(?:-in-out|-in|-out)?(?![\\w-])/', '/cubic-bezier\\(/',
      ],
      '/^(color|background(?:-color)?|border.*|outline.*|fill|stroke|box-shadow|caret-color|text-decoration.*|accent-color)$/': [
        '/#[0-9a-f]{3,8}\\b/i', '/\\b(?:hsla?|rgba?)\\(\\s*[0-9.]/i',
      ],
    }, {severity: 'warning'}],
    'declaration-property-value-allowed-list': {
      '/^(?:(?:padding|margin)(?:-(?:top|right|bottom|left|inline(?:-start|-end)?|block(?:-start|-end)?))?|gap|row-gap|column-gap)$/i': [
        spacingValue,
      ],

    },
  },
  reportDescriptionlessDisables: true,
  reportInvalidScopeDisables: true,
  reportNeedlessDisables: true,
};
