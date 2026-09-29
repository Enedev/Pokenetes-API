import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts'],
      all: true,
      thresholds: {
        lines: 50,
        functions: 0,
        branches: 0,
        statements: 0,
      },
    },
  },
});
