import {fileURLToPath} from 'node:url';
import stylelint from 'stylelint';
import config from '../stylelint.config.mjs';

const codeFilename = fileURLToPath(new URL('../src/index.css', import.meta.url));
const rule = 'declaration-property-value-allowed-list';

async function warningsFor(code) {
  const result = await stylelint.lint({code, codeFilename, config});
  return result.results.flatMap(({warnings}) => warnings);
}

async function assertAllowed(declaration) {
  const warnings = await warningsFor(`.spc2-positive-control { ${declaration}; }`);
  if (warnings.length !== 0) {
    throw new Error(`SPC-2 stylelint positive control failed for ${declaration}: ${JSON.stringify(warnings)}`);
  }
}

async function assertRejected(declaration) {
  const warnings = await warningsFor(`.spc2-negative-control { ${declaration}; }`);
  if (!warnings.some((warning) => [rule, 'design-tokens/role-values'].includes(warning.rule))) {
    throw new Error(`SPC-2 stylelint negative control did not reject ${declaration}`);
  }
}

await assertAllowed('padding: 4px');
await assertAllowed('padding: calc(var(--x) + 4px)');

await assertRejected('padding: 3px');
await assertRejected('padding: calc(7px + var(--x))');
await assertRejected('border-radius: calc(var(--radius) + 3px)');
await assertRejected('PADDING: 7PX');

console.log('SPC-2 stylelint controls passed (2 positive, 4 negative)');

// DSX guards: token declarations and semantic colours remain legal.
for (const value of [
  'transition: color var(--motion-fast) var(--ease-out-soft)',
  'transition-duration: 0s', 'animation-timing-function: linear',
  'color: hsl(var(--foreground) / 0.6)', 'border-radius: var(--radius-lg)',
  'z-index: var(--z-index-menu)', 'font-size: var(--obe-small-size)',
  'font-size: .875em', 'font-size: 1em', '--motion-fast: 120ms', '--obe-code-num: hsl(28 80% 38%)',
]) {
  const warnings = await warningsFor(`.obe-control { ${value}; }`);
  if (warnings.length) throw new Error(`DSX allowed ${value}: ${JSON.stringify(warnings)}`);
}
for (const value of [
  'transition: color 120ms ease', 'transition-duration: 0ms', 'animation: enter .2s ease-out',
  'transition-timing-function: cubic-bezier(0, 0, 1, 1)',
  'color: #abcdef', 'border: 1px solid rgb(1 2 3)',
  'border-radius: 4px', 'border-radius: var(--anything)',
  'font-size: 14px', 'z-index: 4',
]) {
  const warnings = await warningsFor(`.obe-control { ${value}; }`);
  if (!warnings.length || warnings.some(w => w.severity !== 'warning')) throw new Error(`DSX warn guard missed ${value}`);
}
const {readFileSync} = await import('node:fs');
const css = readFileSync(codeFilename, 'utf8');
const reducedBlocks = css.match(/@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\n\}/g) ?? [];
if (reducedBlocks.length !== 2 || !reducedBlocks[0].includes('0.01ms !important') || !reducedBlocks[1].includes('.obe-rcursor-label { animation: none; opacity: 1; }')) {
  throw new Error('Reduced motion must use only the global switch and remote cursor end-state exception');
}
console.log('DSX stylelint controls passed');
