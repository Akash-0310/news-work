import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * Server lint rules (ESLint flat config).
 *
 * Type-aware linting is enabled, so rules can reason about actual types rather than
 * syntax. That is what catches the class of bug this codebase is most exposed to:
 * a floating promise in a request handler, or an `await` on a non-promise.
 *
 * The rules below are the ones with a real justification. Everything stylistic is left
 * to the formatter -- lint failures should mean "this is a bug", not "this is a
 * preference", or people learn to ignore them.
 */
export default tseslint.config(
  {
    // Must be first: later entries cannot re-include an ignored path.
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'prisma/migrations/**'],
  },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  {
    languageOptions: {
      parserOptions: {
        // Uses the nearest tsconfig for each file, which keeps tests (a different
        // tsconfig scope) type-aware too.
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },

    rules: {
      // --- correctness ---------------------------------------------------------
      // The single most valuable rule here. An unhandled rejection in an Express
      // handler hangs the request and bypasses the error middleware entirely, which
      // is exactly why asyncHandler exists.
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': [
        'error',
        // Passing an async function where a void callback is expected silently
        // discards its rejection.
        { checksVoidReturn: { arguments: true, attributes: true } },
      ],
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-unnecessary-condition': 'warn',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      'no-constant-binary-expression': 'error',

      // --- the project's stated "no any" requirement ---------------------------
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',

      // --- hygiene ------------------------------------------------------------
      '@typescript-eslint/no-unused-vars': [
        'error',
        // A leading underscore marks a deliberately unused parameter, which Express
        // middleware signatures require constantly (`_req`, `_res`, `next`).
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'all', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-import-type-side-effects': 'error',

      // Never silence a rule without saying why.
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-expect-error': 'allow-with-description', 'ts-ignore': true },
      ],

      // console is for the seed script (see override); the app uses pino so logs stay
      // structured and get credential redaction.
      'no-console': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-return-await': 'off',
      '@typescript-eslint/return-await': ['error', 'in-try-catch'],
    },
  },

  {
    // The seed script is a CLI tool: console output is its user interface.
    files: ['prisma/**/*.ts'],
    rules: { 'no-console': 'off' },
  },

  {
    // Tests assert on values the type system cannot always narrow, and readability
    // beats strictness in a test body.
    files: ['tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
    },
  },

  {
    // Config files run in Node before the app's module graph exists.
    files: ['*.config.ts', '*.config.js'],
    rules: { 'no-console': 'off' },
  },
);
