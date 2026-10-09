import {RuleTester} from 'eslint';
import {noArbitraryMotion} from './no-arbitrary-motion.mjs';
import {noPaletteColor} from './no-palette-color.mjs';
import {noRawZ} from './no-raw-z.mjs';
const tester = new RuleTester({languageOptions: {ecmaVersion: 2022, sourceType: 'module', parserOptions: {ecmaFeatures: {jsx: true}}}});
const jsx = value => `<div className="${value}" />`;
const invalid = values => values.map(value => ({code: jsx(value), errors: [{messageId: 'token'}]}));
tester.run('no-arbitrary-motion', noArbitraryMotion, {
  valid: [jsx('duration-(--motion-base) ease-out-soft transition-colors'),
    {code: jsx('ease-spring'), filename: '/ui/switch.tsx'},
    {code: jsx('zoom-in-95'), filename: '/ui/overlay-motion.ts'},
    'const text = "duration-200";'],
  invalid: [...invalid(['hover:duration-200', 'duration-[180ms]', 'delay-100', 'delay-[1s]', 'ease-in-out', 'ease-linear', 'ease-[cubic-bezier(0,0,1,1)]', 'animate-[foo_1s]', 'zoom-out-95', 'ease-spring']),
    {code: 'const menuClass = `duration-200 ${active}`;', errors: [{messageId: 'token'}]}],
});
tester.run('no-palette-color', noPaletteColor, {
  valid: [jsx('bg-muted text-muted-foreground bg-[var(--data-red)] text-[hsl(var(--foreground))]'), '<div style={{color: "var(--obe-code-num)"}} />', '<div title="#ffffff" />'],
  invalid: [...invalid(['dark:bg-red-500/20', 'text-slate-100', 'border-t-blue-300', 'bg-[#fff]', 'text-[rgb(0,0,0)]', 'bg-[hsl(0_0%_0%)]']),
    {code: '<div style={{color: "#fff"}} />', errors: [{messageId: 'token'}]},
    {code: '<div style={{borderColor: "rgb(0,0,0)"}} />', errors: [{messageId: 'token'}]}],
});
tester.run('no-raw-z', noRawZ, {
  valid: [jsx('z-menu hover:z-sticky'), 'const label = "z-50";'],
  invalid: [...invalid(['z-50', '-z-10', 'hover:z-[1]', 'z-[var(--x)]']),
    {code: 'const menuStyles = "z-10";', errors: [{messageId: 'token'}]}],
});
