import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    /**
     * The source uses native-ESM import specifiers (`./text.js` referring to
     * `text.ts`), which is what lets `tsc` emit a `dist/` that Node runs without a
     * loader. Vite resolves paths literally, so without this mapping every such import
     * fails during tests with "file not found".
     */
    extensionAlias: { '.js': ['.ts', '.js'] },
  },
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
