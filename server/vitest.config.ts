import { defineConfig } from 'vitest/config';

/**
 * No `resolve.extensionAlias` is needed here. The source uses native-ESM specifiers
 * (`./text.js` pointing at `text.ts`) so that `tsc` output runs under node without a
 * loader, and Vitest 4 resolves that mapping natively. An explicit `extensionAlias`
 * also is not in Vitest 4's `resolve` types, so adding it back breaks `tsc --noEmit`.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Explicit imports from 'vitest' rather than injected globals, so a test file
    // reads the same as any other module and type-checks without extra ambient types.
    globals: false,
    coverage: {
      provider: 'v8',
      include: ['src/pipeline/**', 'src/utils/**'],
      reporter: ['text', 'html'],
    },
  },
});
