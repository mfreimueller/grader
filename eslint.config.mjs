import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ['build/', 'dist/', 'node_modules/', '.scratch/', 'test-results/', 'playwright-report/'],
  },
  {
    // Plugins are browser pages; the fixture runs inside a plugin window.
    files: ['tests/fixtures/plugins/**/*.js'],
    languageOptions: {
      globals: { window: 'readonly', document: 'readonly', fetch: 'readonly' },
    },
  },
  {
    files: ['*.js', '*.mjs', '*.cjs'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
        __dirname: 'readonly',
        require: 'readonly',
        module: 'readonly',
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-extraneous-class': 'off',
    },
  },
);
