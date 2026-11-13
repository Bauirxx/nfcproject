import js from '@eslint/js';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const STORAGE_MESSAGE =
  'Sem estado da aplicação no armazenamento do browser (CLAUDE.md, regra 1). A única exceção é a preferência de tema.';
const HTML_MESSAGE = 'HTML em bruto é proibido: usa JSX, que escapa o conteúdo.';
const PUBLIC_BUNDLE_MESSAGE =
  'Fora do orçamento da página pública (ADR-0003). Usa só React, o cliente da API e as entradas sem dependências de @nfc-business/shared.';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/test-results/**',
      '**/playwright-report/**',
      'apps/web/mocks-static/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      eqeqeq: ['error', 'always'],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',
    },
  },

  // Frontend
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    plugins: { react, 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y },
    languageOptions: {
      globals: { ...globals.browser, __API_MOCKING__: 'readonly' },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: '19.3' } },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...react.configs.flat['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      'react/prop-types': 'off',
      // Segurança no frontend (docs/prompts/FRONTEND.md)
      'react/no-danger': 'error',
      'react/jsx-no-target-blank': ['error', { allowReferrer: false, enforceDynamicLinks: 'always', links: true, forms: true }],
      'react/jsx-no-script-url': 'error',
      'no-console': 'error',
      'no-restricted-globals': [
        'error',
        { name: 'localStorage', message: STORAGE_MESSAGE },
        { name: 'sessionStorage', message: STORAGE_MESSAGE },
        { name: 'indexedDB', message: STORAGE_MESSAGE },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'window', property: 'localStorage', message: STORAGE_MESSAGE },
        { object: 'window', property: 'sessionStorage', message: STORAGE_MESSAGE },
        { object: 'document', property: 'cookie', message: 'As sessões vivem em cookies HttpOnly geridos pelo backend.' },
        { object: 'document', property: 'write', message: HTML_MESSAGE },
      ],
      'no-restricted-syntax': [
        'error',
        { selector: "AssignmentExpression[left.property.name='innerHTML']", message: HTML_MESSAGE },
        { selector: "AssignmentExpression[left.property.name='outerHTML']", message: HTML_MESSAGE },
        { selector: "CallExpression[callee.property.name='insertAdjacentHTML']", message: HTML_MESSAGE },
      ],
    },
  },

  // Página pública e cliente da API: sem dependências pesadas no carregamento inicial (ADR-0003)
  {
    files: [
      'apps/web/src/main.tsx',
      'apps/web/src/features/public-card/**/*.{ts,tsx}',
      'apps/web/src/shared/api/**/*.ts',
      'apps/web/src/shared/i18n/public.ts',
    ],
    ignores: ['**/*.test.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'react-router', message: PUBLIC_BUNDLE_MESSAGE },
            { name: '@tanstack/react-query', message: PUBLIC_BUNDLE_MESSAGE },
            { name: 'react-hook-form', message: PUBLIC_BUNDLE_MESSAGE },
            { name: 'zod', message: PUBLIC_BUNDLE_MESSAGE },
            { name: 'class-variance-authority', message: PUBLIC_BUNDLE_MESSAGE },
            { name: 'tailwind-merge', message: PUBLIC_BUNDLE_MESSAGE },
            { name: 'uqr', message: 'O QR Code da página pública é carregado a pedido (import dinâmico).' },
            { name: '@nfc-business/shared', message: PUBLIC_BUNDLE_MESSAGE },
            { name: '@nfc-business/shared/schemas', message: PUBLIC_BUNDLE_MESSAGE, allowTypeImports: true },
          ],
          patterns: [
            {
              group: ['@/app', '@/app/*', '@/features/*', '@/shared/components/*', '@radix-ui/*', '@dnd-kit/*', '@hookform/*'],
              message: PUBLIC_BUNDLE_MESSAGE,
            },
          ],
        },
      ],
    },
  },

  // Exceções ao armazenamento do browser: simulação da API (só dev/e2e) e preferência de tema
  {
    files: ['apps/web/src/mocks/**/*.{ts,tsx}', 'apps/web/src/shared/lib/theme-preference.ts'],
    rules: { 'no-restricted-globals': 'off', 'no-restricted-properties': 'off' },
  },

  // Testes
  {
    files: ['apps/web/src/**/*.test.{ts,tsx}', 'apps/web/src/test/**/*.{ts,tsx}'],
    rules: { 'react-hooks/rules-of-hooks': 'off' },
  },
  {
    // Os testes verificam precisamente que URLs `javascript:` são rejeitados.
    files: ['**/*.test.{ts,tsx}', 'apps/web/e2e/**/*.ts'],
    rules: { 'no-script-url': 'off' },
  },

  // Código que corre em Node
  {
    files: [
      'apps/web/*.{ts,mjs}',
      'apps/web/e2e/**/*.ts',
      'apps/web/scripts/**/*.mjs',
      'apps/api/**/*.ts',
      'packages/shared/**/*.ts',
      '*.mjs',
    ],
    languageOptions: { globals: globals.node },
  },

  // Backend NestJS: a injeção de dependências lê os tipos do construtor por `emitDecoratorMetadata`,
  // pelo que esses imports têm de ser de valor (não `import type`).
  {
    files: ['apps/api/**/*.ts'],
    rules: { '@typescript-eslint/consistent-type-imports': 'off' },
  },
);
