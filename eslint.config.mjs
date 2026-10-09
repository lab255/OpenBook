// Flat config (ESLint 9). Replaces the legacy .eslintrc.js. One root config
// lints every workspace package; `eslint .` from any package picks it up.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import nextPlugin from '@next/eslint-plugin-next';
import globals from 'globals';
import e2eIsolation from './eslint-rules/e2e-workspace-isolation.mjs';
import noArbitrarySpacing from './eslint-rules/no-arbitrary-spacing.mjs';
import noArbitraryMotion from './eslint-rules/no-arbitrary-motion.mjs';
import noPaletteColor from './eslint-rules/no-palette-color.mjs';
import noRawZ from './eslint-rules/no-raw-z.mjs';
import noHoverGeometry from './eslint-rules/no-hover-geometry.mjs';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/.next/**',
      // Next static export (STAB-7 `build:web-ui` → the LAN web UI bundle). Built
      // JS/manifests, gitignored — never lint them (mirrors the `.next` ignore).
      '**/out/**',
      '**/node_modules/**',
      '**/next-env.d.ts',
      // Playwright / Chromatic run artifacts (generated; includes built JS).
      '**/test-results/**',
      '**/playwright-report/**',
      '**/blob-report/**',
      // Rust host + generated Tauri capability schemas.
      'packages/app/src-tauri/**',
      // Vendored UMD bundles (d3 / Observable Plot) inlined into the HTML export.
      'packages/ui/src/export/vendor/**',
      // Generated mirror of the ledger plugin's PURE report folds (LX-3) —
      // byte-copies of examples/plugins/ledger/src with one import rewritten
      // (see ui scripts/bundlePlugins.ts). Fix the plugin source, regenerate.
      'packages/ui/src/export/ledgerFolds.gen/**',
      // Generated sidecar assets: `build:sidecar` copies the vendored viewer
      // bundle + PGlite wasm/data here for the bun-compiled binary. All
      // generated/vendored (the dir is gitignored); never lint them.
      'packages/server/assets/**',
      '**/*.config.{js,cjs,mjs,ts}',
      'eslint.config.mjs',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Host-realm dynamic code execution is forbidden by default. Narrow
    // non-document exceptions must be annotated at the call site; reactive
    // document evaluation lives in the QuickJS Worker sandbox.
    rules: {
      'no-eval': 'error',
      'no-new-func': 'error',
    },
  },
  {
    // Hover may repaint an element, but it must not alter geometry and shift
    // adjacent content.
    plugins: {'layout-shift': noHoverGeometry},
    rules: {'layout-shift/no-hover-geometry': 'error'},
  },
  {
    // Product spacing follows Tailwind's shared scale; bracket-arbitrary values
    // for padding, margin, and gaps would silently introduce one-off geometry.
    plugins: {tailwind: {rules: {...noArbitrarySpacing.rules, ...noArbitraryMotion.rules, ...noPaletteColor.rules, ...noRawZ.rules}}},
    rules: {'tailwind/no-arbitrary-spacing': 'error'},
  },
  {
    // DSX warn rollout: baseline 13 duration + 3 easing utilities, 208 palette
    // utilities, 43 numeric z utilities; preserve existing debt without CI failure.
    // Measured with these guards at 1d6ef346: motion 33→16, palette 152→152,
    // z 40→40 (includes primitives; excludes generated/vendor sources).
    files: ['packages/{ui,web}/src/**/*.{ts,tsx}'],
    rules: {
      'tailwind/no-arbitrary-motion': 'warn',
      'tailwind/no-palette-color': 'warn',
      'tailwind/no-raw-z': 'warn',
    },
  },
  {
    // Plain Node scripts (build helpers, etc.).
    files: ['**/*.{js,cjs,mjs}'],
    languageOptions: {globals: {...globals.node}},
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {react},
    languageOptions: {
      globals: {...globals.browser, ...globals.node},
      parserOptions: {ecmaFeatures: {jsx: true}},
    },
    settings: {react: {version: '19.0'}},
    rules: {
      ...react.configs.flat.recommended.rules,
      // We use TypeScript + the new JSX transform.
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      // Preserved from the v8 .eslintrc (core stylistic rules; deprecated in
      // ESLint 9 but still functional — they move to @stylistic in ESLint 10).
      'indent': ['error', 2],
      'linebreak-style': ['error', 'unix'],
      'quotes': ['error', 'single'],
      'semi': ['error', 'always'],
    },
  },
  {
    // Next.js rules for the web shell only (replaces `next lint`).
    files: ['packages/web/**/*.{ts,tsx}'],
    plugins: {'@next/next': nextPlugin},
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      // Pages live at packages/web/src/pages, not a root ./pages dir.
      '@next/next/no-html-link-for-pages': 'off',
    },
  },
  {
    // Structural workspace isolation for the Playwright e2e suite (OB-223):
    // forbid the manual name-collision workarounds and require specs that seed
    // hardcoded page/row names to opt into the per-test `freshWorkspace` reset.
    files: ['packages/web/e2e/**/*.spec.ts'],
    plugins: {e2e: e2eIsolation},
    rules: {'e2e/workspace-isolation': 'error'},
  },
  {
    // Upstream primitives retain their formatting/type lint exemption, but
    // DSX guards cover them too (including future overlay motion regressions).
    files: ['packages/ui/src/components/ui/**/*.{ts,tsx}'],
    rules: {
      ...Object.fromEntries(Object.keys({
        ...js.configs.recommended.rules,
        ...Object.assign({}, ...tseslint.configs.recommended.map(config => config.rules)),
        ...react.configs.flat.recommended.rules,
      }).map(name => [name, 'off'])),
      'indent': 'off', 'linebreak-style': 'off', 'quotes': 'off', 'semi': 'off',
      'no-eval': 'off', 'no-new-func': 'off',
      'layout-shift/no-hover-geometry': 'off',
      'tailwind/no-arbitrary-spacing': 'off',
    },
  },
);
