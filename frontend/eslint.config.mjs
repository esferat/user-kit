import js from '@eslint/js';
import importX, { createNodeResolver } from 'eslint-plugin-import-x';
import prettierRecommended from 'eslint-plugin-prettier/recommended';
import sonarjs from 'eslint-plugin-sonarjs';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Flat configuration of the User Kit frontend.
 *
 * On top of the usual TypeScript rules it enforces the Feature Sliced Design
 * boundaries of `src/`: a slice may only import from the layers below it, and
 * every cross slice import has to go through the public API of the target slice
 * (`@/shared/api`, never `@/shared/api/http`).
 */
const LAYERS = ['app', 'pages', 'widgets', 'features', 'entities', 'shared'];

const aliasOf = (layer) => [`@/${layer}`, `@/${layer}/*`];

/** Imports every layer at or above `layer` must not contain. */
function forbiddenLayers(layer) {
  return LAYERS.slice(0, LAYERS.indexOf(layer)).flatMap(aliasOf);
}

/** Deep imports into a layer, e.g. `@/entities/user/model/roles`. */
function forbiddenDeepImports(layer) {
  return [`@/${layer}/*/*`, `@/${layer}/*/*/*`, `@/${layer}/*/*/*/*`];
}

/** One slice level up is fine inside a slice, two levels up always crosses a boundary. */
const RELATIVE_PARENT_IMPORT = ['error', { patterns: ['../../*', '../../../*'] }];

const boundariesOf = (layer) => ({
  'no-restricted-imports': ['error', { patterns: [...forbiddenLayers(layer), ...forbiddenDeepImports(layer)] }],
});

const FSD_BOUNDARIES = LAYERS.map((layer) => ({
  name: `user-kit/fsd/${layer}`,
  files: [`src/${layer}/**/*.{ts,tsx}`],
  rules: boundariesOf(layer),
}));

export default tseslint.config(
  {
    ignores: ['dist/**', 'coverage/**', 'node_modules/**', '*.config.{js,mjs,ts}'],
  },

  js.configs.recommended,
  tseslint.configs.recommended,
  sonarjs.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: globals.browser,
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
    plugins: { 'import-x': importX },
    settings: {
      // `tsconfig: 'auto'` picks up the `@/* -> src/*` alias from tsconfig.json.
      'import-x/resolver-next': [
        createNodeResolver({ extensions: ['.ts', '.tsx', '.mjs', '.js', '.json'], tsconfig: 'auto' }),
      ],
    },
    rules: {
      ...importX.flatConfigs.typescript.rules,
      'import-x/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'type'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
          // Type only imports form their own group at the end, which matches the
          // `separate-type-imports` style produced by consistent-type-imports.
          sortTypesGroup: true,
        },
      ],
      'import-x/no-cycle': ['error', { maxDepth: 10 }],
      'import-x/no-self-import': 'error',
      'import-x/no-relative-packages': 'error',
      eqeqeq: ['error', 'always'],
      curly: ['error', 'all'],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-restricted-imports': RELATIVE_PARENT_IMPORT,
      'object-shorthand': 'error',
      'prefer-const': 'error',
      // `void somePromise()` is the marker for a deliberately un-awaited promise.
      'sonarjs/void-use': 'off',
      '@typescript-eslint/explicit-function-return-type': [
        'error',
        { allowExpressions: true, allowTypedFunctionExpressions: true },
      ],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      '@typescript-eslint/no-unnecessary-condition': 'off',
    },
  },
  ...FSD_BOUNDARIES,
  {
    name: 'user-kit/translations',
    // Dictionaries hold user facing copy, so strings such as `login.missingAuthority`
    // are translations and never credentials.
    files: ['src/shared/i18n/locales/**/*.ts'],
    rules: { 'sonarjs/no-hardcoded-secrets': 'off' },
  },
  {
    name: 'user-kit/tests',
    files: ['**/*.test.ts'],
    rules: {
      // Tests talk to localhost style URLs over http on purpose.
      'sonarjs/no-clear-text-protocols': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
    },
  },
  prettierRecommended,
);
