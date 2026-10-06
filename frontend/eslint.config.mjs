import js from '@eslint/js';
import importX, { createNodeResolver } from 'eslint-plugin-import-x';
import prettierRecommended from 'eslint-plugin-prettier/recommended';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import sonarjs from 'eslint-plugin-sonarjs';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Плоская конфигурация ESLint для фронтенда User Kit.
 *
 * Помимо стандартных правил TypeScript и React, она обеспечивает соблюдение
 * границ Feature Sliced Design (FSD) для `src/`: слайс может импортировать
 * только из слоёв, расположенных ниже него, а любые кросс-слайсовые импорты
 * должны осуществляться через публичный API целевого слайда (`@/shared/api`,
 * не `@/shared/api/http`).
 */
const LAYERS = ['app', 'pages', 'widgets', 'features', 'entities', 'shared'];

const aliasOf = (layer) => [`@/${layer}`, `@/${layer}/*`];

/** Импорты не должны содержать ссылки на любые слои на уровне `layer` и выше. */
function forbiddenLayers(layer) {
  return LAYERS.slice(0, LAYERS.indexOf(layer)).flatMap(aliasOf);
}

/** Глубокие импорты внутрь слоя, например `@/entities/user/model/roles`. */
function forbiddenDeepImports(layer) {
  return [`@/${layer}/*/*`, `@/${layer}/*/*/*`, `@/${layer}/*/*/*/*`];
}

/** Внутри слайда допустим импорт на один уровень выше, импорт на два уровня выше всегда нарушает границы. */
const RELATIVE_PARENT_IMPORT = ['error', { patterns: ['../../*', '../../../*'] }];

const boundariesOf = (layer) => ({
  'no-restricted-imports': ['error', { patterns: [...forbiddenLayers(layer), ...forbiddenDeepImports(layer)] }],
});

const FSD_BOUNDARIES = LAYERS.map((layer) => ({
  name: `user-kit/fsd/${layer}`,
  files: [`src/${layer}/**/*.{ts,tsx}`],
  rules: boundariesOf(layer),
}));

/** `jsx-runtime` заменяет правила `prop-types` из конфигурации `recommended`. */
const REACT_RULES = {
  ...react.configs.flat.recommended.rules,
  ...react.configs.flat['jsx-runtime'].rules,
};

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
      // `tsconfig: 'auto'` автоматически подхватывает алиас `@/* -> src/*` из tsconfig.json.
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
          // Импорты только типов (`type-imports`) группируются в конце, что соответствует
          // стилю `separate-type-imports`, используемому правилом consistent-type-imports.
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
      // `void somePromise()` используется как маркер намеренно неожидаемого промиса.
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
  {
    name: 'user-kit/react',
    files: ['src/**/*.{ts,tsx}'],
    plugins: { react },
    languageOptions: {
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: 'detect' } },
    rules: {
      ...REACT_RULES,
      // Компонент может находиться рядом со своим тестом и хуками.
      'react/jsx-key': 'error',
      'react/no-array-index-key': 'error',
      // Компонент возвращает JSX, поэтому явный тип возврата избыточен.
      '@typescript-eslint/explicit-function-return-type': 'off',
    },
  },
  {
    name: 'user-kit/react-hooks',
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs['recommended-latest'].rules,
      // Правила пресета React compiler ошибочно трактуют допустимые обходные решения
      // в UI5-обёртках (`ref.current`, ручные хранилища) как ошибки.
      'react-hooks/refs': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  ...FSD_BOUNDARIES,
  {
    name: 'user-kit/translations',
    // Файлы словарей содержат пользовательский текст (например, `login.missingAuthority`),
    // поэтому это переводы, а не конфиденциальные данные.
    files: ['src/shared/i18n/locales/**/*.ts'],
    rules: { 'sonarjs/no-hardcoded-secrets': 'off' },
  },
  {
    name: 'user-kit/tests',
    files: ['**/*.test.{ts,tsx}'],
    rules: {
      // В тестах намеренно используются URL вида localhost по протоколу HTTP.
      'sonarjs/no-clear-text-protocols': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      // Вспомогательным компонентам в тестах не требуется display name.
      'react/display-name': 'off',
    },
  },
  prettierRecommended,
);
